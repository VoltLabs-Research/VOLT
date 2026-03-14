import { DockerRuntimeService } from '@/modules/platform/services';
import { logger } from '@/core/logger';
import path from 'node:path';
import type { CreateNotebookSessionResponse, NotebookSessionSnapshot } from '@/shared/contracts';
import type { DaemonConfig } from '@/core/config';

interface EnsureNotebookSessionInput {
    notebook: NotebookSessionSnapshot;
    requestedBy: string;
    publicBasePath: string;
};

interface EnsureJupyterServerInput {
    notebookId: string;
    containerId: string;
    publicBasePath: string;
};

interface NotebookRuntimeState {
    containerId: string;
    hostPort: number;
    publishedHost?: string;
    readinessOrigin?: string;
};

interface JupyterStartupOperation {
    containerId: string;
    controller: AbortController;
    promise: Promise<void>;
    publicBasePath: string;
};

const JUPYTER_HEALTH_CHECK_INTERVAL_MS = 1000;
const DEFAULT_NOTEBOOK_FILE_NAME = 'notebook.ipynb';
const RUNTIME_LABEL_KEY = 'volt.runtime.kind';
const RUNTIME_LABEL_VALUE = 'jupyter';
const NOTEBOOK_ID_LABEL_KEY = 'volt.notebook.id';
const TEAM_ID_LABEL_KEY = 'volt.team.id';
const TEAM_CLUSTER_ID_LABEL_KEY = 'volt.team-cluster.id';
const HTTP_PORTS_LABEL_KEY = 'volt.exposure.http.ports';
const WEBSOCKET_PORTS_LABEL_KEY = 'volt.exposure.websocket.ports';

const sleep = async (delayMs: number, signal?: AbortSignal): Promise<void> => {
    await new Promise<void>((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }

        const timeout = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, delayMs);

        const onAbort = (): void => {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', onAbort);
            resolve();
        };

        signal?.addEventListener('abort', onAbort, { once: true });
    });
};

const getRemainingTimeMs = (deadlineMs: number): number => {
    return Math.max(0, deadlineMs - Date.now());
};

export class JupyterRuntimeService {
    private readonly startupOperations = new Map<string, JupyterStartupOperation>();
    private readonly runtimeStates = new Map<string, NotebookRuntimeState>();

    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntimeService: DockerRuntimeService
    ) {
    }

    async initialize(): Promise<void> {
        await this.dockerRuntimeService.ensureImage(this.config.jupyter.image);
    }

    async ensureSession(input: EnsureNotebookSessionInput): Promise<CreateNotebookSessionResponse> {
        const runtimeState = await this.ensureContainer(input);
        const notebookFilePath = this.getNotebookFilePath(input.notebook.notebookPath);
        const internalPath = this.buildJupyterPath(input.notebook.notebookPath);
        const publicBasePath = this.normalizePublicBasePath(input.publicBasePath);

        this.setRuntimeState(input.notebook._id, runtimeState);

        await this.dockerRuntimeService.writeContainerFile(
            runtimeState.containerId,
            notebookFilePath,
            JSON.stringify(input.notebook.content, null, 2)
        );

        const ready = await this.ensureJupyterServer({
            notebookId: input.notebook._id,
            containerId: runtimeState.containerId,
            publicBasePath
        });
        return {
            jupyter: {
                internalPath,
                url: internalPath,
                ready
            }
        };
    }

    async deleteSession(notebookId: string): Promise<boolean> {
        await this.cancelStartupOperation(notebookId);
        const runtimeState = await this.findRuntimeContainer(notebookId);
        if (!runtimeState) {
            this.runtimeStates.delete(notebookId);
            return false;
        }

        await this.dockerRuntimeService.deleteContainer(runtimeState.containerId);
        this.runtimeStates.delete(notebookId);
        return true;
    }

    async getRuntimeHostPort(notebookId: string): Promise<number | null> {
        const runtimeState = this.runtimeStates.get(notebookId) ?? await this.findRuntimeContainer(notebookId);
        return runtimeState ? runtimeState.hostPort : null;
    }

    getRuntimeInternalOrigin(notebookId: string): string {
        return this.buildRuntimeOrigin(notebookId);
    }

    private async ensureContainer(input: EnsureNotebookSessionInput): Promise<NotebookRuntimeState> {
        const existingContainer = await this.findRuntimeContainer(input.notebook._id);
        if (existingContainer) {
            const currentRuntimeState = this.runtimeStates.get(input.notebook._id);
            await this.startContainerIfNeeded(existingContainer.containerId);
            const publishedBinding = await this.getPublishedPortBinding(existingContainer.containerId);
            return {
                containerId: existingContainer.containerId,
                hostPort: publishedBinding?.hostPort ?? existingContainer.hostPort,
                publishedHost: publishedBinding?.host,
                readinessOrigin: currentRuntimeState?.containerId === existingContainer.containerId
                    ? currentRuntimeState.readinessOrigin
                    : undefined
            };
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
                }
            ],
            ports: [{
                private: this.config.jupyter.port,
                public: reservedHostPort ?? undefined
            }],
            memoryInMegabytes: this.config.jupyter.memoryInMegabytes,
            cpus: this.config.jupyter.cpus,
            labels: {
                [RUNTIME_LABEL_KEY]: RUNTIME_LABEL_VALUE,
                [NOTEBOOK_ID_LABEL_KEY]: input.notebook._id,
                [TEAM_ID_LABEL_KEY]: input.notebook.teamId,
                [TEAM_CLUSTER_ID_LABEL_KEY]: this.config.teamClusterId,
                [HTTP_PORTS_LABEL_KEY]: String(this.config.jupyter.port),
                [WEBSOCKET_PORTS_LABEL_KEY]: String(this.config.jupyter.port)
            },
            cmd: ['tail', '-f', '/dev/null'],
            networkMode: this.resolveComposeNetworkName()
        });

        const publishedBinding = await this.getPublishedPortBinding(container.Id);
        if (!publishedBinding) {
            await this.dockerRuntimeService.deleteContainer(container.Id).catch(() => {});
            throw new Error('Docker did not publish a host port for the Jupyter runtime');
        }

        return {
            containerId: container.Id,
            hostPort: publishedBinding.hostPort,
            publishedHost: publishedBinding.host
        };
    }

    private async findRuntimeContainer(notebookId: string): Promise<NotebookRuntimeState | null> {
        const containers = await this.dockerRuntimeService.listContainers(true, {
            label: [
                `${RUNTIME_LABEL_KEY}=${RUNTIME_LABEL_VALUE}`,
                `${NOTEBOOK_ID_LABEL_KEY}=${notebookId}`
            ]
        });
        const runtimeContainer = containers[0];
        if (!runtimeContainer) {
            this.runtimeStates.delete(notebookId);
            return null;
        }

        const hostPort = runtimeContainer.Ports?.find((port) => port.PrivatePort === this.config.jupyter.port)?.PublicPort;
        if (typeof hostPort !== 'number') {
            this.runtimeStates.delete(notebookId);
            return null;
        }

        const runtimeState = {
            containerId: runtimeContainer.Id,
            hostPort,
            publishedHost: await this.resolvePublishedHost(runtimeContainer.Id),
            readinessOrigin: this.runtimeStates.get(notebookId)?.containerId === runtimeContainer.Id
                ? this.runtimeStates.get(notebookId)?.readinessOrigin
                : undefined
        };

        this.setRuntimeState(notebookId, runtimeState);
        return runtimeState;
    }

    private async startContainerIfNeeded(containerId: string): Promise<void> {
        const container = await this.dockerRuntimeService.getContainer(containerId);
        if (container.State.Running) {
            return;
        }

        await this.dockerRuntimeService.startContainer(containerId);
    }

    /**
     * Returns immediately when the runtime is still cold-starting so callers can
     * respond with `ready: false` and rely on follow-up polling.
     */
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
            if (this.isSameStartupOperation(existingStartupOperation, input)) {
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

        await this.runJupyterStartup(input, startupOperation.controller.signal);
    }

    private async runJupyterStartup(input: EnsureJupyterServerInput, signal: AbortSignal): Promise<void> {
        if (signal.aborted) {
            return;
        }

        const isJupyterProcessRunning = await this.isJupyterServerProcessRunning(input.containerId);
        if (signal.aborted) {
            return;
        }

        if (!isJupyterProcessRunning) {
            try {
                await this.startJupyterServer(input.containerId, input.publicBasePath);
            } catch (error: unknown) {
                if (signal.aborted) {
                    return;
                }

                logger.warn({ err: error, containerId: input.containerId }, 'Failed to start Jupyter server inside container');
                return;
            }
        }

        const ready = await this.waitForJupyterReady(
            input.notebookId,
            input.publicBasePath,
            this.config.jupyter.startTimeoutMs,
            signal
        );
        if (signal.aborted || ready) {
            return;
        }

        await this.logJupyterStartupTimeout(input.notebookId, input.containerId, input.publicBasePath);
    }

    private async startJupyterServer(containerId: string, publicBasePath: string): Promise<void> {
        await this.dockerRuntimeService.exec(containerId, ['/bin/sh', '-lc', 'rm -f /tmp/volt-jupyter.log']);
        await this.dockerRuntimeService.execDetached(containerId, ['/bin/sh', '-lc', this.getStartCommand(publicBasePath)]);
    }

    private async isJupyterServerProcessRunning(containerId: string): Promise<boolean> {
        const result = await this.dockerRuntimeService.exec(containerId, [
            '/bin/sh',
            '-lc',
            "if pgrep -f '[p]ython3 -m jupyter lab' >/dev/null 2>&1; then printf running; fi"
        ]);

        return result.trim() === 'running';
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
            if (response?.status && response.status < 500) {
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
        while (getRemainingTimeMs(deadlineMs) > 0) {
            if (signal?.aborted) {
                return false;
            }

            const remainingTimeMs = getRemainingTimeMs(deadlineMs);
            const requestTimeoutMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, remainingTimeMs);
            if (requestTimeoutMs === 0) {
                break;
            }

            if (await this.isJupyterReady(notebookId, publicBasePath, requestTimeoutMs, signal)) {
                return true;
            }

            const delayMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, getRemainingTimeMs(deadlineMs));
            if (delayMs > 0) {
                await sleep(delayMs, signal);
            }
        }

        return false;
    }

    private async logJupyterStartupTimeout(notebookId: string, containerId: string, publicBasePath: string): Promise<void> {
        try {
            const readinessOrigins = await this.resolveReadinessOrigins(notebookId);
            const jupyterLog = await this.dockerRuntimeService.exec(containerId, [
                '/bin/sh',
                '-lc',
                'tail -n 100 /tmp/volt-jupyter.log 2>/dev/null || true'
            ]);
            logger.warn(
                {
                    notebookId,
                    containerId,
                    runtimeOrigin: readinessOrigins[0],
                    readinessOrigins,
                    jupyterLog: jupyterLog.trim() || undefined,
                    publicBasePath
                },
                'Jupyter server did not become ready before timeout'
            );
        } catch (error: unknown) {
            logger.warn({ err: error, containerId }, 'Failed to collect Jupyter startup log output');
        }
    }

    private buildJupyterPath(notebookPath?: string): string {
        const uiPath = this.resolveUiPath();
        const encodedNotebookPath = notebookPath
            ? notebookPath.split('/').map(encodeURIComponent).join('/')
            : '';
        const basePath = encodedNotebookPath
            ? path.posix.join(uiPath, 'tree', encodedNotebookPath)
            : uiPath;

        return `${basePath}?token=${encodeURIComponent(this.config.jupyter.token)}`;
    }

    private resolveUiPath(): string {
        return this.config.jupyter.uiPath === '/doc' ? '/lab' : this.config.jupyter.uiPath;
    }

    private normalizePublicBasePath(value: string): string {
        const trimmedValue = value.trim();
        const normalizedValue = trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
        return normalizedValue.endsWith('/') ? normalizedValue.slice(0, -1) : normalizedValue;
    }

    private setRuntimeState(notebookId: string, runtimeState: NotebookRuntimeState): void {
        this.runtimeStates.set(notebookId, runtimeState);
    }

    private async getRuntimeState(notebookId: string): Promise<NotebookRuntimeState | null> {
        return this.runtimeStates.get(notebookId) ?? await this.findRuntimeContainer(notebookId);
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

    private buildRuntimeOrigin(notebookId: string): string {
        return `http://${this.buildContainerName(notebookId)}:${this.config.jupyter.port}`;
    }

    private async resolveComposeRuntimeOrigin(notebookId: string, containerId: string): Promise<string | null> {
        const composeNetworkName = this.resolveComposeNetworkName();
        if (!composeNetworkName) {
            return null;
        }

        try {
            const container = await this.dockerRuntimeService.getContainer(containerId);
            const networks = container.NetworkSettings?.Networks;
            return networks?.[composeNetworkName] ? this.getRuntimeInternalOrigin(notebookId) : null;
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

    private async fetchJupyterReadiness(url: string, timeoutMs: number, signal?: AbortSignal): Promise<Response | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const abortFetch = (): void => controller.abort();

        signal?.addEventListener('abort', abortFetch, { once: true });

        try {
            if (signal?.aborted) {
                return null;
            }

            return await fetch(url, {
                signal: controller.signal
            });
        } catch {
            return null;
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abortFetch);
        }
    }

    private getNotebookFilePath(notebookPath?: string): string {
        return path.posix.join(this.config.jupyter.notebookRoot, notebookPath?.trim() || DEFAULT_NOTEBOOK_FILE_NAME);
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

    private isSameStartupOperation(
        startupOperation: JupyterStartupOperation,
        input: EnsureJupyterServerInput
    ): boolean {
        return startupOperation.containerId === input.containerId
            && startupOperation.publicBasePath === input.publicBasePath;
    }

    private getStartCommand(publicBasePath: string): string {
        return [
            `mkdir -p "${this.config.jupyter.notebookRoot}"`,
            '&&',
            'exec python3 -m jupyter lab',
            '--ip=0.0.0.0',
            `--port=${this.config.jupyter.port}`,
            '--port-retries=0',
            '--no-browser',
            `--ServerApp.token="${this.config.jupyter.token}"`,
            `--ServerApp.base_url="${publicBasePath}/"`,
            "--ServerApp.allow_origin='*'",
            '--ServerApp.disable_check_xsrf=True',
            '--ServerApp.allow_remote_access=True',
            `--ServerApp.root_dir="${this.config.jupyter.notebookRoot}"`,
            '--allow-root',
            `--ServerApp.tornado_settings='{"headers":{"Content-Security-Policy":"frame-ancestors ${this.config.jupyter.frameAncestors}"}}'`,
            '> /tmp/volt-jupyter.log 2>&1'
        ].join(' ');
    }
};
