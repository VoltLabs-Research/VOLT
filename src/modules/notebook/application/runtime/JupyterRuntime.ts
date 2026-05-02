import Bottleneck from 'bottleneck';
import { TTLCache } from '@isaacs/ttlcache';
import retry from 'async-retry';

import { Service } from '@/core/decorators/service';
import { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import {
    HTTP_PORTS_LABEL_KEY,
    TEAM_CLUSTER_ID_LABEL_KEY,
    TEAM_ID_LABEL_KEY,
    WEBSOCKET_PORTS_LABEL_KEY,
    resolveComposeDefaultNetworkName
} from '@/core/runtime/contracts/runtime-container';
import { logger } from '@/core/logger';
import { createHash } from 'node:crypto';
import type { CreateNotebookSessionResponse, NotebookContainerStage, NotebookContainerResources, NotebookSessionSnapshot } from '@/contracts';
import type { DaemonConfig } from '@/core/config';
import path from 'node:path';

interface EnsureNotebookSessionInput {
    notebook: NotebookSessionSnapshot;
    requestedBy: string;
    publicBasePath: string;
    containerResources: NotebookContainerResources;
}

interface EnsureJupyterServerInput {
    notebookId: string;
    containerId: string;
    publicBasePath: string;
}

interface ContainerResolutionResult {
    state: NotebookRuntimeState;
    containerStage: NotebookContainerStage;
}

interface NotebookRuntimeState {
    containerId: string;
    hostPort: number;
    publishedHost?: string;
    publicBasePath: string;
    readinessOrigin?: string;
    lastNotebookDigest?: string;
}

interface RuntimeContainerCandidate {
    containerId: string;
    hostPort?: number;
    isRunning: boolean;
}

interface RuntimeTunnelTarget {
    host: string;
    port: number;
}

interface JupyterStartupOperation {
    containerId: string;
    controller: AbortController;
    promise: Promise<void>;
    publicBasePath: string;
}

const JUPYTER_HEALTH_CHECK_INTERVAL_MS = 1000;
const JUPYTER_BACKGROUND_STARTUP_LIMIT = 2;
const RUNTIME_LABEL_KEY = 'volt.runtime.kind';
const RUNTIME_LABEL_VALUE = 'jupyter';
const NOTEBOOK_ID_LABEL_KEY = 'volt.notebook.id';
const RUNTIME_FINGERPRINT_ENV_KEY = 'VOLT_RUNTIME_FINGERPRINT';
const PUBLIC_BASE_PATH_ENV_KEY = 'VOLT_PUBLIC_BASE_PATH';

@Service('jupyterRuntime')
export class JupyterRuntime {
    private static readonly RUNTIME_STATE_TTL_MS = 30 * 60 * 1000;

    private readonly startupOperations = new Map<string, JupyterStartupOperation>();
    private readonly runtimeStates = new TTLCache<string, NotebookRuntimeState>({
        ttl: JupyterRuntime.RUNTIME_STATE_TTL_MS,
        updateAgeOnGet: true,
        checkAgeOnGet: true,
        checkAgeOnHas: true
    });
    private readonly startupLimiter = new Bottleneck({
        maxConcurrent: JUPYTER_BACKGROUND_STARTUP_LIMIT
    });

    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntime: DockerRuntime
    ) {}

    async ensureSession(input: EnsureNotebookSessionInput): Promise<CreateNotebookSessionResponse> {
        const notebookPath = this.resolveNotebookRelativePath(input.notebook.notebookPath);
        const publicBasePath = input.publicBasePath;
        const { state: runtimeState, containerStage } = await this.ensureContainer({
            ...input,
            notebook: {
                ...input.notebook,
                notebookPath
            },
            publicBasePath
        });
        return this.finalizeNotebookSession(
            input.notebook._id,
            runtimeState,
            containerStage,
            notebookPath,
            publicBasePath,
            input.notebook.content
        );
    }

    private async finalizeNotebookSession(
        notebookId: string,
        runtimeState: NotebookRuntimeState,
        containerStage: NotebookContainerStage,
        notebookPath: string,
        publicBasePath: string,
        notebookContent: NotebookSessionSnapshot['content']
    ): Promise<CreateNotebookSessionResponse> {
        const uiPath = this.config.jupyter.uiPath === '/doc' ? '/lab' : this.config.jupyter.uiPath;
        const internalPath = path.posix.join(
            uiPath,
            'tree',
            notebookPath.split('/').map(encodeURIComponent).join('/')
        );
        await this.syncNotebookContents(runtimeState, notebookPath, notebookContent);
        this.setRuntimeState(notebookId, runtimeState);
        const ready = await this.ensureJupyterServer({
            notebookId,
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

    private async syncNotebookContents(
        runtimeState: NotebookRuntimeState,
        notebookPath: string,
        notebookContent: NotebookSessionSnapshot['content']
    ): Promise<void> {
        const notebookContents = JSON.stringify(notebookContent, null, 2);
        const nextNotebookDigest = createHash('sha1').update(notebookContents).digest('hex');
        if (runtimeState.lastNotebookDigest === nextNotebookDigest) {
            return;
        }

        const notebookFilePath = path.posix.join(this.config.jupyter.notebookRoot, notebookPath);
        await this.dockerRuntime.writeContainerFile(
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

    async deleteSession(notebookId: string): Promise<boolean> {
        await this.cancelStartupOperation(notebookId);
        const runtimeContainer = await this.findRuntimeContainerCandidate(notebookId);
        if (!runtimeContainer) {
            this.deleteRuntimeState(notebookId);
            return false;
        }

        await this.dockerRuntime.deleteContainer(runtimeContainer.containerId);
        this.deleteRuntimeState(notebookId);
        return true;
    }

    async getReadyRuntimeTunnelTarget(notebookId: string): Promise<RuntimeTunnelTarget | null> {
        const runtimeState = await this.getReadyRuntimeState(notebookId);
        if (!runtimeState?.readinessOrigin) {
            return null;
        }

        const readinessUrl = new URL(runtimeState.readinessOrigin);
        let port: number;
        if (readinessUrl.port) {
            port = Number(readinessUrl.port);
        } else if (readinessUrl.protocol === 'https:') {
            port = 443;
        } else {
            port = 80;
        }

        return {
            host: readinessUrl.hostname,
            port
        };
    }

    private async ensureContainer(input: EnsureNotebookSessionInput): Promise<ContainerResolutionResult> {
        const existingContainer = await this.findRuntimeContainerCandidate(input.notebook._id);
        if (existingContainer) {
            const shouldRecreateContainer = await this.shouldRecreateContainer(existingContainer.containerId, input);
            if (shouldRecreateContainer) {
                await this.cancelStartupOperation(input.notebook._id);
                await this.dockerRuntime.deleteContainer(existingContainer.containerId);
                this.deleteRuntimeState(input.notebook._id);
            } else {
                const container = await this.dockerRuntime.getContainer(existingContainer.containerId);
                if (!container.State.Running) {
                    await this.dockerRuntime.startContainer(existingContainer.containerId);
                }
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
            ? await this.dockerRuntime.findAvailableHostPort(
                this.config.jupyter.hostPortRange.start,
                this.config.jupyter.hostPortRange.end
            )
            : undefined;

        if (this.config.jupyter.hostPortRange && !reservedHostPort) {
            throw new Error('No available host port for Jupyter runtime');
        }

        const container = await this.dockerRuntime.createContainer({
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
                    key: PUBLIC_BASE_PATH_ENV_KEY,
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
                public: reservedHostPort === null ? undefined : reservedHostPort
            }],
            memoryInMegabytes: input.containerResources.memoryMB,
            cpus: input.containerResources.cpus,
            labels: {
                [RUNTIME_LABEL_KEY]: RUNTIME_LABEL_VALUE,
                [NOTEBOOK_ID_LABEL_KEY]: input.notebook._id,
                [TEAM_ID_LABEL_KEY]: input.notebook.teamId,
                [TEAM_CLUSTER_ID_LABEL_KEY]: this.config.teamClusterId,
                [HTTP_PORTS_LABEL_KEY]: `${this.config.jupyter.port}`,
                [WEBSOCKET_PORTS_LABEL_KEY]: `${this.config.jupyter.port}`
            },
            cmd: this.buildNativeStartupCommand(input.publicBasePath),
            networkMode: resolveComposeDefaultNetworkName(this.config.composeProjectName)
        });

        const hostPort = await this.dockerRuntime.getPublishedPort(container.Id, this.config.jupyter.port);
        if (hostPort === null) {
            await this.dockerRuntime.deleteContainer(container.Id).catch(() => {});
            throw new Error('Docker did not publish a host port for the Jupyter runtime');
        }

        return {
            state: {
                containerId: container.Id,
                hostPort,
                publishedHost: await this.resolvePublishedHost(container.Id),
                publicBasePath: input.publicBasePath
            },
            containerStage: 'creating'
        };
    }

    private async findRuntimeContainer(notebookId: string): Promise<NotebookRuntimeState | null> {
        const runtimeContainer = await this.findRuntimeContainerCandidate(notebookId);
        if (!runtimeContainer || !runtimeContainer.isRunning || runtimeContainer.hostPort === undefined) {
            this.deleteRuntimeState(notebookId);
            return null;
        }

        const currentRuntimeState = this.runtimeStates.get(notebookId);
        let publicBasePath = currentRuntimeState?.containerId === runtimeContainer.containerId
            ? currentRuntimeState.publicBasePath
            : null;

        if (!publicBasePath) {
            publicBasePath = await this.readContainerEnvValue(runtimeContainer.containerId, PUBLIC_BASE_PATH_ENV_KEY);
        }

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
        const includeStoppedContainers = true;
        const containers = await this.dockerRuntime.listContainers(includeStoppedContainers, {
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
            hostPort,
            isRunning: runtimeContainer.State === 'running'
        };
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

        const existingStartupOperation = this.startupOperations.get(input.notebookId);
        if (
            existingStartupOperation
            && existingStartupOperation.containerId === input.containerId
            && existingStartupOperation.publicBasePath === input.publicBasePath
        ) {
            return false;
        }

        this.startStartupOperation(input, existingStartupOperation);
        return false;
    }

    private startStartupOperation(
        input: EnsureJupyterServerInput,
        existingStartupOperation?: JupyterStartupOperation
    ): void {
        const controller = new AbortController();
        const startupOperation: JupyterStartupOperation = {
            containerId: input.containerId,
            controller,
            promise: Promise.resolve(),
            publicBasePath: input.publicBasePath
        };
        startupOperation.promise = this.runStartupOperation(input, startupOperation, existingStartupOperation)
            .catch((error) => {
                this.logStartupOperationError(input, startupOperation, error);
            })
            .finally(() => {
                this.cleanupStartupOperation(input.notebookId, startupOperation);
            });
        this.startupOperations.set(input.notebookId, startupOperation);
    }

    private logStartupOperationError = (
        input: EnsureJupyterServerInput,
        startupOperation: JupyterStartupOperation,
        error: Error
    ): void => {
        if (startupOperation.controller.signal.aborted) {
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
    };

    private cleanupStartupOperation = (notebookId: string, startupOperation: JupyterStartupOperation): void => {
        const currentStartupOperation = this.startupOperations.get(notebookId);
        if (currentStartupOperation === startupOperation) {
            this.startupOperations.delete(notebookId);
        }
    };

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

        await this.startupLimiter.schedule(async () => {
            if (startupOperation.controller.signal.aborted) {
                return;
            }

            const deadlineMs = Date.now() + Math.max(this.config.jupyter.startTimeoutMs, 0);
            let ready = false;

            try {
                await retry(async (bail) => {
                    if (startupOperation.controller.signal.aborted) {
                        bail(new Error('Jupyter startup cancelled'));
                        return;
                    }

                    const remainingTimeMs = Math.max(0, deadlineMs - Date.now());
                    if (remainingTimeMs === 0) {
                        bail(new Error('Jupyter server did not become ready before timeout'));
                        return;
                    }

                    const requestTimeoutMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, remainingTimeMs);
                    if (await this.isJupyterReady(input.notebookId, input.publicBasePath, requestTimeoutMs, startupOperation.controller.signal)) {
                        ready = true;
                        return;
                    }

                    throw new Error('Jupyter server is not ready yet');
                }, {
                    retries: Math.max(1, Math.ceil(Math.max(this.config.jupyter.startTimeoutMs, 0) / JUPYTER_HEALTH_CHECK_INTERVAL_MS)),
                    minTimeout: JUPYTER_HEALTH_CHECK_INTERVAL_MS,
                    maxTimeout: JUPYTER_HEALTH_CHECK_INTERVAL_MS,
                    factor: 1,
                    randomize: false
                });
            } catch {
                if (startupOperation.controller.signal.aborted) {
                    return;
                }
            }

            if (startupOperation.controller.signal.aborted || ready) {
                return;
            }

            try {
                const readinessOrigins = await this.resolveReadinessOrigins(input.notebookId);
                logger.warn(`Jupyter server did not become ready before timeout for notebookId=${input.notebookId}, containerId=${input.containerId}, runtimeOrigin=${readinessOrigins[0] ?? 'unknown'}, readinessOrigins=${readinessOrigins.join(',')}, publicBasePath=${input.publicBasePath}`);
            } catch (error) {
                logger.warn(`Failed to report Jupyter startup timeout for containerId=${input.containerId}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
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
            let response: Response | null = null;
            try {
                response = await fetch(
                    `${readinessOrigin}${apiPath}?token=${encodeURIComponent(this.config.jupyter.token)}`,
                    {
                        signal: signal
                            ? AbortSignal.any([signal, AbortSignal.timeout(requestTimeoutMs)])
                            : AbortSignal.timeout(requestTimeoutMs)
                    }
                );
            } catch {}
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

    private resolveNotebookRelativePath(value: string): string {
        if (!value) {
            throw new Error('Notebook path is required');
        }

        if (path.posix.isAbsolute(value)) {
            throw new Error('Notebook path must be relative to notebook root');
        }

        const normalizedPath = path.posix.normalize(value);
        if (normalizedPath === '.' || normalizedPath === '..' || normalizedPath.startsWith('../')) {
            throw new Error('Notebook path must stay within notebook root');
        }

        return normalizedPath;
    }

    private setRuntimeState(notebookId: string, runtimeState: NotebookRuntimeState): void {
        this.runtimeStates.set(notebookId, runtimeState);
    }

    private getRuntimeState(notebookId: string): Promise<NotebookRuntimeState | null> {
        const cached = this.runtimeStates.get(notebookId);
        if (cached) {
            return Promise.resolve(cached);
        }

        return this.findRuntimeContainer(notebookId);
    }

    private deleteRuntimeState(notebookId: string): void {
        this.runtimeStates.delete(notebookId);
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

        const composeNetworkName = resolveComposeDefaultNetworkName(this.config.composeProjectName);
        if (composeNetworkName) {
            try {
                const container = await this.dockerRuntime.getContainer(resolvedRuntimeState.containerId);
                if (container.NetworkSettings?.Networks?.[composeNetworkName]) {
                    readinessOrigins.add(this.buildHttpOrigin(this.buildContainerName(notebookId), this.config.jupyter.port));
                }
            } catch {}
        }

        for (const publishedRuntimeOrigin of this.buildPublishedRuntimeOrigins(
            resolvedRuntimeState.hostPort,
            resolvedRuntimeState.publishedHost
        )) {
            readinessOrigins.add(publishedRuntimeOrigin);
        }

        return [...readinessOrigins];
    }

    private buildPublishedRuntimeOrigins(hostPort: number, publishedHost?: string): string[] {
        const origins = new Set<string>();
        if (publishedHost && !this.isWildcardHost(publishedHost)) {
            origins.add(this.buildHttpOrigin(publishedHost, hostPort));
        }

        const configuredHost = this.config.host;
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

    private async resolvePublishedHost(containerId: string): Promise<string | undefined> {
        try {
            const container = await this.dockerRuntime.getContainer(containerId);
            const binding = container.NetworkSettings?.Ports?.[`${this.config.jupyter.port}/tcp`]?.[0];
            return binding?.HostIp;
        } catch {
            return undefined;
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
            networkMode: resolveComposeDefaultNetworkName(this.config.composeProjectName),
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

    private async shouldRecreateContainer(
        containerId: string,
        input: EnsureNotebookSessionInput
    ): Promise<boolean> {
        const currentFingerprint = await this.readContainerEnvValue(containerId, RUNTIME_FINGERPRINT_ENV_KEY);
        if (currentFingerprint === null) {
            return false;
        }

        return currentFingerprint !== this.buildRuntimeFingerprint(input);
    }

    private async readContainerEnvValue(containerId: string, key: string): Promise<string | null> {
        try {
            const environment = (await this.dockerRuntime.getContainer(containerId)).Config.Env;
            if (!environment) {
                return null;
            }

            const prefix = `${key}=`;
            const entry = environment.find((value) => value.startsWith(prefix));
            return entry ? entry.slice(prefix.length) : null;
        } catch {
            return null;
        }
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

}
