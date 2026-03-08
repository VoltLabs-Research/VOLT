import { getJupyterRuntimeConfig } from '@modules/scripting/utilities/jupyter-runtime-config';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IContainerService } from '@modules/container/domain/port/IContainerService';

const JUPYTER_HEALTH_CHECK_INTERVAL_MS = 1000;

@injectable()
export class JupyterServerService {
    private readonly runtime = getJupyterRuntimeConfig();

    constructor(
        @inject(CONTAINER_TOKENS.ContainerService)
        private readonly containerService: IContainerService
    ) {}

    async ensureServer(containerId: string, hostPort: number): Promise<boolean> {
        if (await this.isJupyterHttpReady(hostPort, 1000)) {
            return true;
        }

        await this.startServer(containerId);
        return this.waitForJupyterHttpReady(hostPort, this.runtime.jupyter.startTimeoutMs);
    }

    buildJupyterUrl(hostPort: number, notebookPath?: string): string {
        let encodedNotebookPath = '';

        if (notebookPath) {
            encodedNotebookPath = notebookPath.split('/').map(encodeURIComponent).join('/');
        }

        const rootPath = `/${this.runtime.jupyter.uiPath.replace(/^\/+|\/+$/g, '')}`;
        let labPath = rootPath;

        if (encodedNotebookPath) {
            labPath = `${rootPath}/tree/${encodedNotebookPath}`;
        }

        return `${this.runtime.jupyter.publicProtocol}://${this.runtime.jupyter.publicHost}:${hostPort}${labPath}?token=${encodeURIComponent(this.runtime.jupyter.token)}`;
    }

    private async startServer(containerId: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new ApplicationError(
                    ErrorCodes.DOCKER_EXEC_ERROR,
                    'Timed out while starting Jupyter inside the container',
                    504
                ));
            }, this.runtime.execTimeoutMs);

            this.containerService.exec(containerId, ['/bin/sh', '-lc', this.getStartCommand()])
                .then(() => {
                    clearTimeout(timer);
                    resolve();
                })
                .catch(() => {
                    clearTimeout(timer);
                    reject(new ApplicationError(
                        ErrorCodes.DOCKER_EXEC_ERROR,
                        'Failed to start Jupyter inside the container',
                        500
                    ));
                });
        });
    }

    private async isJupyterHttpReady(hostPort: number, timeoutMs: number): Promise<boolean> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(
                `http://127.0.0.1:${hostPort}/api?token=${encodeURIComponent(this.runtime.jupyter.token)}`,
                { signal: controller.signal }
            );

            return response.status < 500;
        } catch {
            return false;
        } finally {
            clearTimeout(timer);
        }
    }

    private async waitForJupyterHttpReady(hostPort: number, timeoutMs: number): Promise<boolean> {
        const maxAttempts = Math.max(1, Math.ceil(Math.max(timeoutMs, 0) / JUPYTER_HEALTH_CHECK_INTERVAL_MS));

        return this.retryUntilReady(
            () => this.isJupyterHttpReady(hostPort, JUPYTER_HEALTH_CHECK_INTERVAL_MS),
            maxAttempts,
            JUPYTER_HEALTH_CHECK_INTERVAL_MS
        );
    }

    private async retryUntilReady(
        operation: () => Promise<boolean>,
        maxAttempts: number,
        delayMs: number
    ): Promise<boolean> {
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            if (await operation()) {
                return true;
            }

            if (attempt < maxAttempts) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }

        return false;
    }

    private getStartCommand(): string {
        const { jupyter, notebookRoot } = this.runtime;

        return [
            `mkdir -p "${notebookRoot}"`,
            '&&',
            'nohup python3 -m jupyter lab',
            '--ip=0.0.0.0',
            `--port=${jupyter.port}`,
            '--no-browser',
            `--ServerApp.token="${jupyter.token}"`,
            "--ServerApp.allow_origin='*'",
            '--ServerApp.disable_check_xsrf=True',
            '--ServerApp.allow_remote_access=True',
            `--ServerApp.root_dir="${notebookRoot}"`,
            '--allow-root',
            `--ServerApp.tornado_settings='{"headers":{"Content-Security-Policy":"frame-ancestors ${jupyter.frameAncestors}"}}'`,
            '> /tmp/volt-jupyter.log 2>&1 &'
        ].join(' ');
    }
};
