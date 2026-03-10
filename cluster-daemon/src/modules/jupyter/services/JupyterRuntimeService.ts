import { DAEMON_PATHS } from '../../../core/paths';
import { DockerRuntimeService } from '../../platform/services';
import { logger } from '../../../core/logger';
import path from 'node:path';
import type { CreateNotebookSessionResponse } from '../../../shared/contracts';
import type { DaemonConfig } from '../../../core/config';
import type { ScriptingNotebookDocument } from '../models/ScriptingNotebookModel';

interface EnsureNotebookSessionInput {
    notebook: ScriptingNotebookDocument;
    requestedBy: string;
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

const sleep = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
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
            await this.dockerRuntimeService.buildImage(this.config.jupyter.image, DAEMON_PATHS.scriptingDockerContext);
        }
    }

    async ensureSession(input: EnsureNotebookSessionInput): Promise<CreateNotebookSessionResponse> {
        const runtimeContainer = await this.ensureContainer(input);
        const notebookFilePath = this.getNotebookFilePath(input.notebook.notebookPath);

        await this.dockerRuntimeService.writeContainerFile(
            runtimeContainer.containerId,
            notebookFilePath,
            JSON.stringify(input.notebook.content, null, 2)
        );

        const ready = await this.ensureJupyterServer(runtimeContainer.containerId, runtimeContainer.hostPort);
        return {
            jupyter: {
                url: this.buildJupyterUrl(input.notebook._id, input.notebook.notebookPath),
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
            return existingContainer;
        }

        const hostPort = await this.dockerRuntimeService.findAvailableHostPort(
            this.config.jupyter.hostPortRange.start,
            this.config.jupyter.hostPortRange.end
        );
        if (!hostPort) {
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
                    value: input.notebook.team
                },
                {
                    key: 'VOLT_REQUESTED_BY',
                    value: input.requestedBy
                }
            ],
            ports: [{
                private: this.config.jupyter.port,
                public: hostPort
            }],
            memoryInMegabytes: this.config.jupyter.memoryInMegabytes,
            cpus: this.config.jupyter.cpus,
            labels: {
                [RUNTIME_LABEL_KEY]: RUNTIME_LABEL_VALUE,
                [NOTEBOOK_ID_LABEL_KEY]: input.notebook._id,
                [TEAM_ID_LABEL_KEY]: input.notebook.team
            },
            cmd: ['tail', '-f', '/dev/null']
        });

        return {
            containerId: container.Id,
            hostPort
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

    private async ensureJupyterServer(containerId: string, hostPort: number): Promise<boolean> {
        if (await this.isJupyterReady(hostPort, JUPYTER_HEALTH_CHECK_INTERVAL_MS)) {
            return true;
        }

        try {
            await this.dockerRuntimeService.exec(containerId, ['/bin/sh', '-lc', this.getStartCommand()]);
        } catch (error: unknown) {
            logger.warn({ err: error, containerId }, 'Failed to start Jupyter server inside container');
        }

        return this.waitForJupyterReady(hostPort, this.config.jupyter.startTimeoutMs);
    }

    private async isJupyterReady(hostPort: number, timeoutMs: number): Promise<boolean> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(`http://127.0.0.1:${hostPort}/api?token=${encodeURIComponent(this.config.jupyter.token)}`, {
                signal: controller.signal
            });
            return response.status < 500;
        } catch {
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async waitForJupyterReady(hostPort: number, timeoutMs: number): Promise<boolean> {
        const maxAttempts = Math.max(1, Math.ceil(Math.max(timeoutMs, 0) / JUPYTER_HEALTH_CHECK_INTERVAL_MS));
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            if (await this.isJupyterReady(hostPort, JUPYTER_HEALTH_CHECK_INTERVAL_MS)) {
                return true;
            }

            if (attempt < maxAttempts) {
                await sleep(JUPYTER_HEALTH_CHECK_INTERVAL_MS);
            }
        }

        return false;
    }

    private buildJupyterUrl(notebookId: string, notebookPath?: string): string {
        let encodedNotebookPath = '';
        if (notebookPath) {
            encodedNotebookPath = notebookPath.split('/').map(encodeURIComponent).join('/');
        }

        let labPath = `${this.config.jupyter.publicBasePath}/${encodeURIComponent(notebookId)}${this.config.jupyter.uiPath}`;
        if (encodedNotebookPath) {
            labPath = `${labPath}/tree/${encodedNotebookPath}`;
        }

        return `${labPath}?token=${encodeURIComponent(this.config.jupyter.token)}`;
    }

    private getNotebookFilePath(notebookPath?: string): string {
        return path.posix.join(this.config.jupyter.notebookRoot, notebookPath?.trim() || DEFAULT_NOTEBOOK_FILE_NAME);
    }

    private buildContainerName(notebookId: string): string {
        return `volt-jupyter-${notebookId}`;
    }

    private getStartCommand(): string {
        return [
            `mkdir -p "${this.config.jupyter.notebookRoot}"`,
            '&&',
            'nohup python3 -m jupyter lab',
            '--ip=0.0.0.0',
            `--port=${this.config.jupyter.port}`,
            '--no-browser',
            `--ServerApp.token="${this.config.jupyter.token}"`,
            "--ServerApp.allow_origin='*'",
            '--ServerApp.disable_check_xsrf=True',
            '--ServerApp.allow_remote_access=True',
            `--ServerApp.root_dir="${this.config.jupyter.notebookRoot}"`,
            '--allow-root',
            `--ServerApp.tornado_settings='{"headers":{"Content-Security-Policy":"frame-ancestors ${this.config.jupyter.frameAncestors}"}}'`,
            '> /tmp/volt-jupyter.log 2>&1 &'
        ].join(' ');
    }
};
