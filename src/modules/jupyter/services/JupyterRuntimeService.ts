import { DAEMON_PATHS } from '@/core/paths';
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

interface NotebookRuntimeContainer {
    containerId: string;
    hostPort: number;
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

const sleep = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
};

const getRemainingTimeMs = (deadlineMs: number): number => {
    return Math.max(0, deadlineMs - Date.now());
};

export class JupyterRuntimeService {
    constructor(
        private readonly config: DaemonConfig,
        private readonly dockerRuntimeService: DockerRuntimeService
    ) {
    }

    async initialize(): Promise<void> {
        try {
            await this.dockerRuntimeService.ensureImage(this.config.jupyter.image);
        } catch {
            await this.dockerRuntimeService.buildImage(this.config.jupyter.image, DAEMON_PATHS.scriptingImageContext);
        }
    }

    async ensureSession(input: EnsureNotebookSessionInput): Promise<CreateNotebookSessionResponse> {
        const runtimeContainer = await this.ensureContainer(input);
        const notebookFilePath = this.getNotebookFilePath(input.notebook.notebookPath);
        const internalPath = this.buildJupyterPath(input.notebook.notebookPath);
        const publicBasePath = this.normalizePublicBasePath(input.publicBasePath);

        await this.dockerRuntimeService.writeContainerFile(
            runtimeContainer.containerId,
            notebookFilePath,
            JSON.stringify(input.notebook.content, null, 2)
        );

        const ready = await this.ensureJupyterServer(runtimeContainer.containerId, runtimeContainer.hostPort, publicBasePath);
        return {
            jupyter: {
                internalPath,
                url: internalPath,
                ready
            }
        };
    }

    async deleteSession(notebookId: string): Promise<boolean> {
        const runtimeContainer = await this.findRuntimeContainer(notebookId);
        if (!runtimeContainer) {
            return false;
        }

        await this.dockerRuntimeService.deleteContainer(runtimeContainer.containerId);
        return true;
    }

    async getRuntimeHostPort(notebookId: string): Promise<number | null> {
        const runtimeContainer = await this.findRuntimeContainer(notebookId);
        return runtimeContainer ? runtimeContainer.hostPort : null;
    }

    private async ensureContainer(input: EnsureNotebookSessionInput): Promise<NotebookRuntimeContainer> {
        const existingContainer = await this.findRuntimeContainer(input.notebook._id);
        if (existingContainer) {
            await this.startContainerIfNeeded(existingContainer.containerId);
            const refreshedHostPort = await this.dockerRuntimeService.getPublishedPort(existingContainer.containerId, this.config.jupyter.port);
            return {
                containerId: existingContainer.containerId,
                hostPort: refreshedHostPort ?? existingContainer.hostPort
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
            cmd: ['tail', '-f', '/dev/null']
        });

        const publishedHostPort = await this.dockerRuntimeService.getPublishedPort(container.Id, this.config.jupyter.port);
        if (typeof publishedHostPort !== 'number') {
            await this.dockerRuntimeService.deleteContainer(container.Id).catch(() => {});
            throw new Error('Docker did not publish a host port for the Jupyter runtime');
        }

        return {
            containerId: container.Id,
            hostPort: publishedHostPort
        };
    }

    private async findRuntimeContainer(notebookId: string): Promise<NotebookRuntimeContainer | null> {
        const containers = await this.dockerRuntimeService.listContainers(true, {
            label: [
                `${RUNTIME_LABEL_KEY}=${RUNTIME_LABEL_VALUE}`,
                `${NOTEBOOK_ID_LABEL_KEY}=${notebookId}`
            ]
        });
        const runtimeContainer = containers[0];
        if (!runtimeContainer) {
            return null;
        }

        const hostPort = runtimeContainer.Ports?.find((port) => port.PrivatePort === this.config.jupyter.port)?.PublicPort;
        if (typeof hostPort !== 'number') {
            return null;
        }

        return {
            containerId: runtimeContainer.Id,
            hostPort
        };
    }

    private async startContainerIfNeeded(containerId: string): Promise<void> {
        const container = await this.dockerRuntimeService.getContainer(containerId);
        if (container.State.Running) {
            return;
        }

        await this.dockerRuntimeService.startContainer(containerId);
    }

    private async ensureJupyterServer(containerId: string, hostPort: number, publicBasePath: string): Promise<boolean> {
        const isAlreadyReady = await this.isJupyterReady(hostPort, publicBasePath, JUPYTER_HEALTH_CHECK_INTERVAL_MS);
        if (isAlreadyReady) {
            return true;
        }

        const isJupyterProcessRunning = await this.isJupyterServerProcessRunning(containerId);
        if (!isJupyterProcessRunning) {
            try {
                await this.startJupyterServer(containerId, publicBasePath);
            } catch (error: unknown) {
                logger.warn({ err: error, containerId }, 'Failed to start Jupyter server inside container');
            }
        }

        const ready = await this.waitForJupyterReady(hostPort, publicBasePath, this.config.jupyter.startTimeoutMs);
        if (!ready) {
            await this.logJupyterStartupTimeout(containerId, hostPort, publicBasePath);

            const isJupyterProcessStillRunning = await this.isJupyterServerProcessRunning(containerId);
            try {
                await this.startJupyterServer(containerId, publicBasePath);
                logger.warn(
                    {
                        containerId,
                        hostPort,
                        publicBasePath,
                        wasProcessRunning: isJupyterProcessStillRunning
                    },
                    'Reset Jupyter server after readiness timeout'
                );
            } catch (error: unknown) {
                logger.warn({ err: error, containerId }, 'Failed to reset Jupyter server after readiness timeout');
            }
        }

        return ready;
    }

    private async startJupyterServer(containerId: string, publicBasePath: string): Promise<void> {
        await this.dockerRuntimeService.exec(containerId, ['/bin/sh', '-lc', this.getStopCommand()]);
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

    private async isJupyterReady(hostPort: number, publicBasePath: string, timeoutMs: number): Promise<boolean> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const apiPath = path.posix.join(publicBasePath, 'api');
            const response = await fetch(`http://127.0.0.1:${hostPort}${apiPath}?token=${encodeURIComponent(this.config.jupyter.token)}`, {
                signal: controller.signal
            });
            return response.status < 500;
        } catch {
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async waitForJupyterReady(hostPort: number, publicBasePath: string, timeoutMs: number): Promise<boolean> {
        const deadlineMs = Date.now() + Math.max(timeoutMs, 0);
        while (getRemainingTimeMs(deadlineMs) > 0) {
            const remainingTimeMs = getRemainingTimeMs(deadlineMs);
            const requestTimeoutMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, remainingTimeMs);
            if (requestTimeoutMs === 0) {
                break;
            }

            if (await this.isJupyterReady(hostPort, publicBasePath, requestTimeoutMs)) {
                return true;
            }

            const delayMs = Math.min(JUPYTER_HEALTH_CHECK_INTERVAL_MS, getRemainingTimeMs(deadlineMs));
            if (delayMs > 0) {
                await sleep(delayMs);
            }
        }

        return false;
    }

    private async logJupyterStartupTimeout(containerId: string, hostPort: number, publicBasePath: string): Promise<void> {
        try {
            const jupyterLog = await this.dockerRuntimeService.exec(containerId, [
                '/bin/sh',
                '-lc',
                'tail -n 100 /tmp/volt-jupyter.log 2>/dev/null || true'
            ]);
            logger.warn(
                {
                    containerId,
                    hostPort,
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

    private getNotebookFilePath(notebookPath?: string): string {
        return path.posix.join(this.config.jupyter.notebookRoot, notebookPath?.trim() || DEFAULT_NOTEBOOK_FILE_NAME);
    }

    private buildContainerName(notebookId: string): string {
        return `volt-jupyter-${notebookId}`;
    }

    private getStopCommand(): string {
        return "pkill -f '[p]ython3 -m jupyter lab' >/dev/null 2>&1 || true";
    }

    private getStartCommand(publicBasePath: string): string {
        return [
            `mkdir -p "${this.config.jupyter.notebookRoot}"`,
            '&&',
            'exec python3 -m jupyter lab',
            '--ip=0.0.0.0',
            `--port=${this.config.jupyter.port}`,
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
