import { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';
import { logger } from '@/core/logger';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { CreateNotebookSessionResponse, NotebookContainerStage, NotebookContainerResources, NotebookSessionSnapshot } from '@/contracts';
import type { DaemonConfig } from '@/core/config';

interface EnsureNotebookSessionInput {
    notebook: NotebookSessionSnapshot;
    requestedBy: string;
    publicBasePath: string;
    containerResources: NotebookContainerResources;
};

interface EnsureJupyterServerInput {
    notebookId: string;
    containerId: string;
    publicBasePath: string;
};

interface ContainerResolutionResult {
    state: NotebookRuntimeState;
    containerStage: NotebookContainerStage;
};

interface NotebookRuntimeState {
    containerId: string;
    hostPort: number;
    publishedHost?: string;
    publicBasePath: string;
    readinessOrigin?: string;
    lastNotebookDigest?: string;
};

interface RuntimeContainerCandidate {
    containerId: string;
    hostPort: number | null;
    isRunning: boolean;
};

interface JupyterStartupOperation {
    containerId: string;
    controller: AbortController;
    promise: Promise<void>;
    publicBasePath: string;
};

interface JupyterStartupSlotWaiter {
    grant: () => boolean;
};

const JUPYTER_HEALTH_CHECK_INTERVAL_MS = 1000;
const JUPYTER_BACKGROUND_STARTUP_LIMIT = 2;
const RUNTIME_LABEL_KEY = 'volt.runtime.kind';
const RUNTIME_LABEL_VALUE = 'jupyter';
const NOTEBOOK_ID_LABEL_KEY = 'volt.notebook.id';
const TEAM_ID_LABEL_KEY = 'volt.team.id';
const TEAM_CLUSTER_ID_LABEL_KEY = 'volt.team-cluster.id';
const HTTP_PORTS_LABEL_KEY = 'volt.exposure.http.ports';
const WEBSOCKET_PORTS_LABEL_KEY = 'volt.exposure.websocket.ports';
const RUNTIME_FINGERPRINT_ENV_KEY = 'VOLT_RUNTIME_FINGERPRINT';

const sleep = async (delayMs: number, signal?: AbortSignal): Promise<void> => {
    await delay(delayMs, undefined, { signal }).catch(() => undefined);
};

export class JupyterRuntimeService {
    private static readonly RUNTIME_STATE_TTL_MS = 30 * 60 * 1000;
    private static readonly RUNTIME_STATE_SWEEP_INTERVAL_MS = 60 * 1000;

    private readonly startupOperations = new Map<string, JupyterStartupOperation>();
    private readonly runtimeStates = new Map<string, NotebookRuntimeState>();
    private readonly runtimeStateActivity = new Map<string, number>();
    private readonly runtimeStateSweepTimer: ReturnType<typeof setInterval>;
    private readonly startupSlotWaiters: JupyterStartupSlotWaiter[] = [];
    private activeStartupOperations = 0;

    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntimeService: DockerRuntimeService
    ) {
        this.runtimeStateSweepTimer = setInterval(() => {
            this.sweepIdleRuntimeStates();
        }, JupyterRuntimeService.RUNTIME_STATE_SWEEP_INTERVAL_MS);
        if (this.runtimeStateSweepTimer.unref) {
            this.runtimeStateSweepTimer.unref();
        }
    }

    async ensureSession(input: EnsureNotebookSessionInput): Promise<CreateNotebookSessionResponse> {
        const notebookPath = this.resolveNotebookRelativePath(input.notebook.notebookPath);
        const publicBasePath = this.normalizePublicBasePath(input.publicBasePath);
        const { state: runtimeState, containerStage } = await this.ensureContainer({
            ...input,
            notebook: {
                ...input.notebook,
                notebookPath
            },
            publicBasePath
        });
        const notebookFilePath = path.posix.join(this.config.jupyter.notebookRoot, notebookPath);
        const internalPath = this.buildJupyterPath(notebookPath);
        const notebookContents = JSON.stringify(input.notebook.content, null, 2);
        const nextNotebookDigest = createHash('sha1').update(notebookContents).digest('hex');

        if (runtimeState.lastNotebookDigest !== nextNotebookDigest) {
            await this.dockerRuntimeService.writeContainerFile(
                runtimeState.containerId,
                notebookFilePath,
                notebookContents,
                {
                    operationName: 'jupyter-write-notebook',
                    timeoutMs: this.config.jupyter.execTimeoutMs
                }
            );
            runtimeState.lastNotebookDigest = nextNotebookDigest;
        }

        this.setRuntimeState(input.notebook._id, runtimeState);

        const ready = await this.ensureJupyterServer({
            notebookId: input.notebook._id,
            containerId: runtimeState.containerId,
            publicBasePath
        });
        const resolvedStage: NotebookContainerStage = ready ? 'ready' : containerStage;
        return {
            jupyter: {
                internalPath,
                url: internalPath,
                ready,
                containerStage: resolvedStage
            }
        };
    }

    async deleteSession(notebookId: string): Promise<boolean> {
        await this.cancelStartupOperation(notebookId);
        const runtimeContainer = await this.findRuntimeContainerCandidate(notebookId);
        if (!runtimeContainer) {
            this.deleteRuntimeState(notebookId);
            return false;
        }

        await this.dockerRuntimeService.deleteContainer(runtimeContainer.containerId);
        this.deleteRuntimeState(notebookId);
        return true;
    }

    async getReadyRuntimeTunnelTarget(notebookId: string): Promise<{ host: string; port: number; } | null> {
        const runtimeState = await this.getReadyRuntimeState(notebookId);
        if (!runtimeState?.readinessOrigin) {
            return null;
        }

        const readinessUrl = new URL(runtimeState.readinessOrigin);
        const port = readinessUrl.port
            ? Number(readinessUrl.port)
            : readinessUrl.protocol === 'https:'
                ? 443
                : 80;

        return {
            host: readinessUrl.hostname,
            port
        };
    }

    private async ensureContainer(input: EnsureNotebookSessionInput): Promise<ContainerResolutionResult> {
        const existingContainer = await this.findRuntimeContainerCandidate(input.notebook._id);
        if (existingContainer) {
            if (await this.shouldRecreateContainer(existingContainer.containerId, input)) {
                await this.cancelStartupOperation(input.notebook._id);
                await this.dockerRuntimeService.deleteContainer(existingContainer.containerId);
                this.deleteRuntimeState(input.notebook._id);
            } else {
                await this.startContainerIfNeeded(existingContainer.containerId);
                const runtimeState = await this.findRuntimeContainer(input.notebook._id);
                if (!runtimeState) {
                    throw new Error('Docker did not publish a host port for the Jupyter runtime');
                }

                return {
                    state: runtimeState,
                    containerStage: 'starting'
                };
            }
        }

        const reservedHostPort = this.config.jupyter.hostPortRange
            ? await this.dockerRuntimeService.findAvailableHostPort(
                this.config.jupyter.hostPortRange.start,
                this.config.jupyter.hostPortRange.end
            )
            : undefined;

        if (this.config.jupyter.hostPortRange && !reservedHostPort) {
            throw new Error('No available host port for Jupyter runtime');
        }

        const container = await this.dockerRuntimeService.createContainer({
            image: this.config.jupyter.image,
            name: this.buildContainerName(input.notebook._id),
            env: [
                {
                    key: 'JUPYTER_TOKEN',
                    value: this.config.jupyter.token
                },
                {
                    key: 'VOLT_NOTEBOOK_ID',
                    value: input.notebook._id
                },
                {
                    key: 'VOLT_NOTEBOOK_PATH',
                    value: input.notebook.notebookPath
                },
                {
                    key: 'VOLT_TEAM_ID',
                    value: input.notebook.teamId
                },
                {
                    key: 'VOLT_REQUESTED_BY',
                    value: input.requestedBy
                },
                {
                    key: 'VOLT_PUBLIC_BASE_PATH',
                    value: input.publicBasePath
                },
                {
                    key: 'DOCKER_STACKS_JUPYTER_CMD',
                    value: 'lab'
                },
                {
                    key: RUNTIME_FINGERPRINT_ENV_KEY,
                    value: this.buildRuntimeFingerprint(input)
                }
            ],
            ports: [{
                private: this.config.jupyter.port,
                public: reservedHostPort ?? undefined
            }],
            memoryInMegabytes: input.containerResources.memoryMB,
            cpus: input.containerResources.cpus,
            labels: {
                [RUNTIME_LABEL_KEY]: RUNTIME_LABEL_VALUE,
                [NOTEBOOK_ID_LABEL_KEY]: input.notebook._id,
                [TEAM_ID_LABEL_KEY]: input.notebook.teamId,
                [TEAM_CLUSTER_ID_LABEL_KEY]: this.config.teamClusterId,
                [HTTP_PORTS_LABEL_KEY]: String(this.config.jupyter.port),
                [WEBSOCKET_PORTS_LABEL_KEY]: String(this.config.jupyter.port)
            },
            cmd: this.buildNativeStartupCommand(input.publicBasePath),
            networkMode: this.resolveComposeNetworkName()
        });

        const publishedBinding = await this.getPublishedPortBinding(container.Id);
        if (!publishedBinding) {
            await this.dockerRuntimeService.deleteContainer(container.Id).catch(() => {});
            throw new Error('Docker did not publish a host port for the Jupyter runtime');
        }

        return {
            state: {
                containerId: container.Id,
                hostPort: publishedBinding.hostPort,
                publishedHost: publishedBinding.host,
                publicBasePath: input.publicBasePath
            },
            containerStage: 'creating'
        };
    }

    private async findRuntimeContainer(notebookId: string): Promise<NotebookRuntimeState | null> {
        const runtimeContainer = await this.findRuntimeContainerCandidate(notebookId);
        if (!runtimeContainer?.isRunning || typeof runtimeContainer.hostPort !== 'number') {
            this.deleteRuntimeState(notebookId);
            return null;
        }

        const currentRuntimeState = this.runtimeStates.get(notebookId);
        const publicBasePath = currentRuntimeState?.containerId === runtimeContainer.containerId
            ? currentRuntimeState.publicBasePath
            : await this.resolvePublicBasePath(runtimeContainer.containerId);
        if (!publicBasePath) {
            this.deleteRuntimeState(notebookId);
            return null;
        }

        const runtimeState = {
            containerId: runtimeContainer.containerId,
            hostPort: runtimeContainer.hostPort,
            publishedHost: await this.resolvePublishedHost(runtimeContainer.containerId),
            publicBasePath,
            lastNotebookDigest: currentRuntimeState?.containerId === runtimeContainer.containerId
                ? currentRuntimeState.lastNotebookDigest
                : undefined,
            readinessOrigin: currentRuntimeState?.containerId === runtimeContainer.containerId
                ? currentRuntimeState.readinessOrigin
                : undefined
        };

        this.setRuntimeState(notebookId, runtimeState);
        return runtimeState;
    }

    private async findRuntimeContainerCandidate(notebookId: string): Promise<RuntimeContainerCandidate | null> {
        const containers = await this.dockerRuntimeService.listContainers(true, {
            label: [
                `${RUNTIME_LABEL_KEY}=${RUNTIME_LABEL_VALUE}`,
                `${NOTEBOOK_ID_LABEL_KEY}=${notebookId}`
            ]
        });
        const runtimeContainer = [...containers].sort((left, right) => {
            const runningDelta = Number(right.State === 'running') - Number(left.State === 'running');
            if (runningDelta !== 0) {
                return runningDelta;
            }

            return (right.Created ?? 0) - (left.Created ?? 0);
        })[0];
        if (!runtimeContainer) {
            return null;
        }

        const hostPort = runtimeContainer.Ports?.find((port) => port.PrivatePort === this.config.jupyter.port)?.PublicPort;
        return {
            containerId: runtimeContainer.Id,
            hostPort: typeof hostPort === 'number' ? hostPort : null,
            isRunning: runtimeContainer.State === 'running'
        };
    }

    private async startContainerIfNeeded(containerId: string): Promise<void> {
        const container = await this.dockerRuntimeService.getContainer(containerId);
        if (container.State.Running) {
            return;
        }

        await this.dockerRuntimeService.startContainer(containerId);
    }

    private async ensureJupyterServer(input: EnsureJupyterServerInput): Promise<boolean> {
        const isAlreadyReady = await this.isJupyterReady(
            input.notebookId,
            input.publicBasePath,
            JUPYTER_HEALTH_CHECK_INTERVAL_MS
        );
        if (isAlreadyReady) {
            return true;
        }

        this.ensureStartupInBackground(input);
        return false;
    }

    private ensureStartupInBackground(input: EnsureJupyterServerInput): void {
        const existingStartupOperation = this.startupOperations.get(input.notebookId);
        if (existingStartupOperation) {
            if (
                existingStartupOperation.containerId === input.containerId
                && existingStartupOperation.publicBasePath === input.publicBasePath
            ) {
                return;
            }
        }

        const controller = new AbortController();
        const startupOperation: JupyterStartupOperation = {
            containerId: input.containerId,
            controller,
            promise: Promise.resolve(),
            publicBasePath: input.publicBasePath
        };
        const startupPromise = this.runStartupOperation(input, startupOperation, existingStartupOperation)
            .catch((error: unknown) => {
                if (controller.signal.aborted) {
                    return;
                }

                logger.warn(
                    {
                        err: error,
                        notebookId: input.notebookId,
                        containerId: input.containerId,
                        publicBasePath: input.publicBasePath
                    },
                    'Unexpected error while ensuring Jupyter server startup'
                );
            })
            .finally(() => {
                const currentStartupOperation = this.startupOperations.get(input.notebookId);
                if (currentStartupOperation === startupOperation) {
                    this.startupOperations.delete(input.notebookId);
                }
        });

        startupOperation.promise = startupPromise;
        this.startupOperations.set(input.notebookId, startupOperation);
    }

    private async runStartupOperation(
        input: EnsureJupyterServerInput,
        startupOperation: JupyterStartupOperation,
        existingStartupOperation?: JupyterStartupOperation
    ): Promise<void> {
        if (existingStartupOperation) {
            existingStartupOperation.controller.abort();
            await existingStartupOperation.promise;
        }

        if (startupOperation.controller.signal.aborted) {
            return;
        }

        const acquiredSlot = await this.acquireStartupSlot(startupOperation.controller.signal);
        if (!acquiredSlot || startupOperation.controller.signal.aborted) {
            return;
        }

        try {
            if (startupOperation.controller.signal.aborted) {
                return;
            }

            const ready = await this.waitForJupyterReady(
                input.notebookId,
                input.publicBasePath,
                this.config.jupyter.startTimeoutMs,
                startupOperation.controller.signal
            );
            if (startupOperation.controller.signal.aborted || ready) {
                return;
            }

            await this.logJupyterStartupTimeout(input.notebookId, input.containerId, input.publicBasePath);
        } finally {
            this.releaseStartupSlot();
        }
    }

    private async isJupyterReady(
        notebookId: string,
        publicBasePath: string,
        timeoutMs: number,
        signal?: AbortSignal
    ): Promise<boolean> {
        if (signal?.aborted) {
            return false;
        }

        const runtimeState = await this.getRuntimeState(notebookId);
        if (!runtimeState) {
            return false;
        }

        const readinessOrigins = await this.resolveReadinessOrigins(notebookId, runtimeState);
        if (readinessOrigins.length === 0) {
            return false;
        }

        const apiPath = path.posix.join(publicBasePath, 'api');
        for (let index = 0; index < readinessOrigins.length; index += 1) {
            const readinessOrigin = readinessOrigins[index];
            const remainingAttempts = readinessOrigins.length - index;
            const requestTimeoutMs = Math.max(1, Math.floor(timeoutMs / remainingAttempts));
            const response = await this.fetchJupyterReadiness(
                `${readinessOrigin}${apiPath}?token=${encodeURIComponent(this.config.jupyter.token)}`,
                requestTimeoutMs,
                signal
            );
            if (response?.ok) {
                this.setRuntimeState(notebookId, {
                    ...runtimeState,
                    readinessOrigin
                });
                return true;
            }
        }

        return false;
    }

    private async waitForJupyterReady(
        notebookId: string,
        publicBasePath: string,
        timeoutMs: number,
        signal?: AbortSignal
    ): Promise<boolean> {
        const deadlineMs = Date.now() + Math.max(timeoutMs, 0);
        while (Math.max(0, deadlineMs - Date.now()) > 0) {
            if (signal?.aborted) {
                return false;
            }

            const remainingTimeMs = Math.max(0, deadlineMs - Date.now());
            const requestTimeoutMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, remainingTimeMs);
            if (requestTimeoutMs === 0) {
                break;
            }

            if (await this.isJupyterReady(notebookId, publicBasePath, requestTimeoutMs, signal)) {
                return true;
            }

            const delayMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, Math.max(0, deadlineMs - Date.now()));
            if (delayMs > 0) {
                await sleep(delayMs, signal);
            }
        }

        return false;
    }

    private async logJupyterStartupTimeout(notebookId: string, containerId: string, publicBasePath: string): Promise<void> {
        try {
            const readinessOrigins = await this.resolveReadinessOrigins(notebookId);
            logger.warn(
                {
                    notebookId,
                    containerId,
                    runtimeOrigin: readinessOrigins[0],
                    readinessOrigins,
                    publicBasePath
                },
                'Jupyter server did not become ready before timeout'
            );
        } catch (error: unknown) {
            logger.warn({ err: error, containerId }, 'Failed to report Jupyter startup timeout');
        }
    }

    private buildJupyterPath(notebookPath: string): string {
        const uiPath = this.config.jupyter.uiPath === '/doc' ? '/lab' : this.config.jupyter.uiPath;
        const encodedNotebookPath = notebookPath.split('/').map(encodeURIComponent).join('/');
        return path.posix.join(uiPath, 'tree', encodedNotebookPath);
    }

    private normalizePublicBasePath(value: string): string {
        const trimmedValue = value.trim();
        const normalizedValue = trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
        if (normalizedValue === '/') {
            return '/';
        }

        return normalizedValue.endsWith('/') ? normalizedValue.slice(0, -1) : normalizedValue;
    }

    private resolveNotebookRelativePath(value: string): string {
        const notebookPath = value.trim();
        if (!notebookPath) {
            throw new Error('Notebook path is required');
        }

        if (path.posix.isAbsolute(notebookPath)) {
            throw new Error('Notebook path must be relative to notebook root');
        }

        const normalizedPath = path.posix.normalize(notebookPath);
        if (!normalizedPath || normalizedPath === '.' || normalizedPath === '..' || normalizedPath.startsWith('../')) {
            throw new Error('Notebook path must stay within notebook root');
        }

        return normalizedPath;
    }

    private setRuntimeState(notebookId: string, runtimeState: NotebookRuntimeState): void {
        this.runtimeStates.set(notebookId, runtimeState);
        this.runtimeStateActivity.set(notebookId, Date.now());
    }

    private async getRuntimeState(notebookId: string): Promise<NotebookRuntimeState | null> {
        const cached = this.runtimeStates.get(notebookId);
        if (cached) {
            this.runtimeStateActivity.set(notebookId, Date.now());
            return cached;
        }
        return this.findRuntimeContainer(notebookId);
    }

    private sweepIdleRuntimeStates(): void {
        const now = Date.now();
        for (const [notebookId, lastActive] of this.runtimeStateActivity) {
            if (now - lastActive > JupyterRuntimeService.RUNTIME_STATE_TTL_MS) {
                this.runtimeStates.delete(notebookId);
                this.runtimeStateActivity.delete(notebookId);
            }
        }
    }

    private deleteRuntimeState(notebookId: string): void {
        this.runtimeStates.delete(notebookId);
        this.runtimeStateActivity.delete(notebookId);
    }

    private async getReadyRuntimeState(notebookId: string): Promise<NotebookRuntimeState | null> {
        const runtimeState = await this.findRuntimeContainer(notebookId);
        if (!runtimeState) {
            return null;
        }

        if (runtimeState.readinessOrigin) {
            return runtimeState;
        }

        const ready = await this.isJupyterReady(
            notebookId,
            runtimeState.publicBasePath,
            JUPYTER_HEALTH_CHECK_INTERVAL_MS
        );
        if (!ready) {
            return null;
        }

        const readyRuntimeState = this.runtimeStates.get(notebookId);
        return readyRuntimeState?.readinessOrigin ? readyRuntimeState : null;
    }

    private async resolveReadinessOrigins(
        notebookId: string,
        runtimeState?: NotebookRuntimeState
    ): Promise<string[]> {
        const resolvedRuntimeState = runtimeState ?? await this.getRuntimeState(notebookId);
        if (!resolvedRuntimeState) {
            return [];
        }

        const readinessOrigins = new Set<string>();
        if (resolvedRuntimeState.readinessOrigin) {
            readinessOrigins.add(resolvedRuntimeState.readinessOrigin);
        }

        const composeRuntimeOrigin = await this.resolveComposeRuntimeOrigin(notebookId, resolvedRuntimeState.containerId);
        if (composeRuntimeOrigin) {
            readinessOrigins.add(composeRuntimeOrigin);
        }

        for (const publishedRuntimeOrigin of this.buildPublishedRuntimeOrigins(
            resolvedRuntimeState.hostPort,
            resolvedRuntimeState.publishedHost
        )) {
            readinessOrigins.add(publishedRuntimeOrigin);
        }

        return [...readinessOrigins];
    }

    private async resolveComposeRuntimeOrigin(notebookId: string, containerId: string): Promise<string | null> {
        const composeNetworkName = this.resolveComposeNetworkName();
        if (!composeNetworkName) {
            return null;
        }

        try {
            const container = await this.dockerRuntimeService.getContainer(containerId);
            const networks = container.NetworkSettings?.Networks;
            return networks?.[composeNetworkName]
                ? this.buildHttpOrigin(this.buildContainerName(notebookId), this.config.jupyter.port)
                : null;
        } catch {
            return null;
        }
    }

    private buildPublishedRuntimeOrigins(hostPort: number, publishedHost?: string): string[] {
        const origins = new Set<string>();
        if (publishedHost && !this.isWildcardHost(publishedHost)) {
            origins.add(this.buildHttpOrigin(publishedHost, hostPort));
        }

        const configuredHost = this.config.host.trim();
        if (configuredHost && !this.isWildcardHost(configuredHost)) {
            origins.add(this.buildHttpOrigin(configuredHost, hostPort));
        }

        origins.add(this.buildHttpOrigin('127.0.0.1', hostPort));
        return [...origins];
    }

    private buildHttpOrigin(host: string, port: number): string {
        const normalizedHost = host.includes(':') && !host.startsWith('[')
            ? `[${host}]`
            : host;
        return `http://${normalizedHost}:${port}`;
    }

    private isWildcardHost(host: string): boolean {
        return host === '0.0.0.0' || host === '::' || host === '[::]';
    }

    private async getPublishedPortBinding(containerId: string): Promise<{
        hostPort: number;
        host?: string;
    } | null> {
        const hostPort = await this.dockerRuntimeService.getPublishedPort(containerId, this.config.jupyter.port);
        if (typeof hostPort !== 'number') {
            return null;
        }

        return {
            hostPort,
            host: await this.resolvePublishedHost(containerId)
        };
    }

    private async resolvePublishedHost(containerId: string): Promise<string | undefined> {
        try {
            const container = await this.dockerRuntimeService.getContainer(containerId);
            const binding = container.NetworkSettings?.Ports?.[`${this.config.jupyter.port}/tcp`]?.[0];
            const host = binding?.HostIp?.trim();
            return host ? host : undefined;
        } catch {
            return undefined;
        }
    }

    private async resolvePublicBasePath(containerId: string): Promise<string | null> {
        try {
            const container = await this.dockerRuntimeService.getContainer(containerId);
            const environment = container.Config?.Env ?? [];
            const publicBasePath = environment
                .find((entry) => entry.startsWith('VOLT_PUBLIC_BASE_PATH='))
                ?.slice('VOLT_PUBLIC_BASE_PATH='.length)
                ?.trim();

            return publicBasePath ? this.normalizePublicBasePath(publicBasePath) : null;
        } catch {
            return null;
        }
    }

    private async fetchJupyterReadiness(url: string, timeoutMs: number, signal?: AbortSignal): Promise<Response | null> {
        try {
            if (signal?.aborted) {
                return null;
            }

            return await fetch(url, {
                signal: signal
                    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
                    : AbortSignal.timeout(timeoutMs)
            });
        } catch {
            return null;
        }
    }

    private async shouldRecreateContainer(containerId: string, input: EnsureNotebookSessionInput): Promise<boolean> {
        try {
            const container = await this.dockerRuntimeService.getContainer(containerId);
            const environment = container.Config?.Env ?? [];
            return !environment.includes(`${RUNTIME_FINGERPRINT_ENV_KEY}=${this.buildRuntimeFingerprint(input)}`);
        } catch {
            return false;
        }
    }

    private buildRuntimeFingerprint(input: EnsureNotebookSessionInput): string {
        return createHash('sha1').update(JSON.stringify({
            image: this.config.jupyter.image,
            notebookPath: input.notebook.notebookPath,
            teamId: input.notebook.teamId,
            requestedBy: input.requestedBy,
            publicBasePath: input.publicBasePath,
            hostPortRange: this.config.jupyter.hostPortRange,
            port: this.config.jupyter.port,
            token: this.config.jupyter.token,
            frameAncestors: this.config.jupyter.frameAncestors,
            notebookRoot: this.config.jupyter.notebookRoot,
            networkMode: this.resolveComposeNetworkName(),
            containerResources: input.containerResources,
            startupCommand: this.buildNativeStartupCommand(input.publicBasePath)
        })).digest('hex');
    }

    private buildNativeStartupCommand(publicBasePath: string): string[] {
        const tornadoSettings = JSON.stringify({
            headers: {
                'Content-Security-Policy': `frame-ancestors ${this.config.jupyter.frameAncestors}`
            }
        });
        const baseUrl = publicBasePath === '/' ? '/' : `${publicBasePath}/`;

        return [
            '/bin/sh',
            '-lc',
            [
                `mkdir -p "${this.config.jupyter.notebookRoot}"`,
                '&&',
                'exec start-notebook.py',
                '--ServerApp.ip=0.0.0.0',
                `--ServerApp.port=${this.config.jupyter.port}`,
                '--ServerApp.port_retries=0',
                '--ServerApp.open_browser=False',
                `--ServerApp.token="${this.config.jupyter.token}"`,
                `--ServerApp.base_url="${baseUrl}"`,
                '--ServerApp.allow_remote_access=True',
                `--ServerApp.root_dir="${this.config.jupyter.notebookRoot}"`,
                '--ServerApp.allow_root=True',
                `--ServerApp.tornado_settings='${tornadoSettings}'`
            ].join(' ')
        ];
    }

    private buildContainerName(notebookId: string): string {
        return `volt-jupyter-${notebookId}`;
    }

    private resolveComposeNetworkName(): string | undefined {
        if (!this.config.composeProjectName) {
            return undefined;
        }

        return `${this.config.composeProjectName}_default`;
    }

    private async cancelStartupOperation(notebookId: string): Promise<void> {
        const startupOperation = this.startupOperations.get(notebookId);
        if (!startupOperation) {
            return;
        }

        startupOperation.controller.abort();
        this.startupOperations.delete(notebookId);
        await startupOperation.promise;
    }

    private async acquireStartupSlot(signal: AbortSignal): Promise<boolean> {
        if (signal.aborted) {
            return false;
        }

        if (this.activeStartupOperations < JUPYTER_BACKGROUND_STARTUP_LIMIT) {
            this.activeStartupOperations += 1;
            return true;
        }

        return new Promise<boolean>((resolve) => {
            const onAbort = (): void => {
                this.removeStartupSlotWaiter(waiter);
                resolve(false);
            };

            const waiter: JupyterStartupSlotWaiter = {
                grant: () => {
                    signal.removeEventListener('abort', onAbort);
                    if (signal.aborted) {
                        resolve(false);
                        return false;
                    }

                    this.activeStartupOperations += 1;
                    resolve(true);
                    return true;
                }
            };

            signal.addEventListener('abort', onAbort, { once: true });
            this.startupSlotWaiters.push(waiter);
        });
    }

    private releaseStartupSlot(): void {
        if (this.activeStartupOperations > 0) {
            this.activeStartupOperations -= 1;
        }

        while (this.startupSlotWaiters.length > 0 && this.activeStartupOperations < JUPYTER_BACKGROUND_STARTUP_LIMIT) {
            const waiter = this.startupSlotWaiters.shift();
            if (!waiter) {
                return;
            }

            if (waiter.grant()) {
                return;
            }
        }
    }

    private removeStartupSlotWaiter(waiterToRemove: JupyterStartupSlotWaiter): void {
        const waiterIndex = this.startupSlotWaiters.indexOf(waiterToRemove);
        if (waiterIndex >= 0) {
            this.startupSlotWaiters.splice(waiterIndex, 1);
        }
    }

};
