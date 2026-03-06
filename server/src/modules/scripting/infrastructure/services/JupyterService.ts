import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { IContainerService } from '@modules/container/domain/port/IContainerService';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import type { Container } from '@modules/container/domain/entities/Container';
import { getJupyterRuntimeConfig } from '../utilities/jupyter-runtime-config';

const DEFAULT_NOTEBOOK_TEMPLATE_PATH = path.join(
    __dirname,
    'templates',
    'default-scripting-notebook.ipynb'
);
const DEFAULT_SESSION_NOTEBOOK_PATH = 'default-scripting-notebook.ipynb';

interface StartJupyterSessionInput {
    teamId: string;
    trajectoryId: string;
    userId: string;
    notebook?: {
        notebookPath: string;
        content?: unknown;
    };
}

interface EnsureContainerResult {
    container: Container;
    hostPort: number;
}

export interface StartJupyterSessionResult {
    jupyter: {
        url: string;
        ready: boolean;
    };
}

@injectable()
export class JupyterService{
    private readonly runtime = getJupyterRuntimeConfig();

    constructor(
        @inject('IContainerRepository')
        private readonly containerRepository: IContainerRepository,

        @inject('IContainerService')
        private readonly containerService: IContainerService,

        @inject(CreateContainerUseCase)
        private readonly createContainerUseCase: CreateContainerUseCase
    ){}

    public async startSession(input: StartJupyterSessionInput): Promise<StartJupyterSessionResult>{
        const { teamId, trajectoryId, userId } = input;
        const notebook = input.notebook || {
            notebookPath: DEFAULT_SESSION_NOTEBOOK_PATH
        };
        const { container, hostPort } = await this.ensureJupyterContainer(teamId, trajectoryId, userId);

        await this.writeNotebookFile(container.containerId, trajectoryId, notebook);

        const isReady = await this.ensureServer(container.containerId, hostPort);
        return {
            jupyter: {
                url: this.buildJupyterUrl(hostPort, notebook.notebookPath),
                ready: isReady
            }
        };
    }

    private async ensureJupyterContainer(teamId: string, trajectoryId: string, userId: string): Promise<EnsureContainerResult>{
        const containerName = `Jupyter Lab - TID ${trajectoryId}`;
        const existingContainer = await this.containerRepository.findOne({
            team: teamId,
            name: containerName
        });

        if(existingContainer){
            const reused = await this.tryReuseExistingContainer(existingContainer);
            if(reused) return reused;

            await this.removeBrokenContainer(existingContainer);
        }

        return this.createContainer(teamId, userId, containerName);
    }

    private async tryReuseExistingContainer(container: Container): Promise<EnsureContainerResult | null>{
        let hostPort = await this.containerService.getPublishedPort(container.containerId, this.runtime.jupyter.port);

        if(!hostPort){
            await this.containerService.startContainer(container.containerId);
            hostPort = await this.containerService.getPublishedPort(container.containerId, this.runtime.jupyter.port);
        }

        if(!hostPort) return null;

        if(container.status !== 'running' && container._id){
            await this.containerRepository.updateById(container._id, { status: 'running' });
        }

        return { container, hostPort };
    }

    private async removeBrokenContainer(container: Container): Promise<void>{
        if(!container._id) return;

        await this.containerRepository.deleteById(container._id);
        await this.containerService.removeContainer(container.containerId);
    }

    public async deleteSession(trajectoryId: string): Promise<void>{
        const containerName = `Jupyter Lab - TID ${trajectoryId}`;
        const existingContainers = await this.containerRepository.findAll({
            filter: { name: containerName } as any
        });

        if (existingContainers.data && existingContainers.data.length > 0) {
            await Promise.all(
                existingContainers.data.map(container => this.removeBrokenContainer(container))
            );
        }
    }

    private async createContainer(teamId: string, userId: string, containerName: string): Promise<EnsureContainerResult>{
        const { start, end } = this.runtime.jupyter.hostPortRange;
        const hostPort = await this.containerService.findAvailableHostPort(start, end);
        if(!hostPort){
            throw new ApplicationError(ErrorCodes.DOCKER_CREATE_ERROR, ErrorCodes.DOCKER_CREATE_ERROR, 500);
        }

        const created = await this.createContainerUseCase.execute({
            name: containerName,
            image: this.runtime.jupyter.image,
            teamId,
            userId,
            memory: this.runtime.memoryMb,
            cpus: this.runtime.cpus,
            mountDockerSocket: false,
            useImageCmd: false,
            cmd: ['tail', '-f', '/dev/null'],
            env: [],
            ports: [{
                private: this.runtime.jupyter.port,
                public: hostPort
            }]
        });

        if(!created.success){
            throw new ApplicationError(ErrorCodes.DOCKER_CREATE_ERROR, ErrorCodes.DOCKER_CREATE_ERROR, 500);
        }

        return {
            container: created.value.container,
            hostPort
        };
    }

    private async startServer(containerId: string): Promise<void>{
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new ApplicationError(ErrorCodes.DOCKER_EXEC_ERROR, ErrorCodes.DOCKER_EXEC_ERROR, 504));
            }, this.runtime.execTimeoutMs);

            this.containerService.exec(containerId, ['/bin/sh', '-lc', this.getStartCommand()])
                .then(() => {
                    clearTimeout(timer);
                    resolve();
                })
                .catch(() => {
                    clearTimeout(timer);
                    reject(new ApplicationError(ErrorCodes.DOCKER_EXEC_ERROR, ErrorCodes.DOCKER_EXEC_ERROR, 500));
                });
        });
    }

    private async ensureServer(containerId: string, hostPort: number): Promise<boolean>{
        if(await this.isJupyterHttpReady(hostPort, 1000)) return true;

        await this.startServer(containerId);
        const isReady = await this.waitForJupyterHttpReady(hostPort, this.runtime.jupyter.startTimeoutMs);

        return isReady;
    }

    private async writeNotebookFile(
        containerId: string,
        trajectoryId: string,
        notebook: NonNullable<StartJupyterSessionInput['notebook']>
    ): Promise<void>{
        const absNotebookPath = path.posix.join(this.runtime.notebookRoot, notebook.notebookPath);
        await this.containerService.writeFile(
            containerId,
            absNotebookPath,
            this.resolveNotebookRawContent(notebook, { trajectoryId })
        );
    }

    private resolveNotebookRawContent(
        notebook: NonNullable<StartJupyterSessionInput['notebook']>,
        context: { trajectoryId: string }
    ): string {
        if (typeof notebook.content === 'string') {
            return notebook.content;
        }

        if (notebook.content != null) {
            return JSON.stringify(notebook.content, null, 2);
        }

        return this.resolveDefaultNotebookTemplateContent(context);
    }

    public resolveDefaultNotebookTemplateContent(context: { trajectoryId: string }): string {
        const serverDomain = process.env.SERVER_ENDPOINT;
        if (!serverDomain) {
            throw new ApplicationError(ErrorCodes.RESOURCE_LOAD_ERROR, ErrorCodes.RESOURCE_LOAD_ERROR, 500);
        }

        return fs.readFileSync(DEFAULT_NOTEBOOK_TEMPLATE_PATH, 'utf8')
            .replace(/<BASE_URL>/g, serverDomain.replace(/\/+$/g, ''))
            .replace(/<TRAJECTORY_ID>/g, context.trajectoryId);
    }

    private buildJupyterUrl(hostPort: number, notebookPath?: string): string{
        const encodedNotebookPath = notebookPath
            ? notebookPath.split('/').map((part) => encodeURIComponent(part)).join('/')
            : '';

        const rootPath = `/${this.runtime.jupyter.uiPath.replace(/^\/+|\/+$/g, '')}`;
        const labPath = encodedNotebookPath ? `${rootPath}/tree/${encodedNotebookPath}` : rootPath;

        return `${this.runtime.jupyter.publicProtocol}://${this.runtime.jupyter.publicHost}:${hostPort}${labPath}?token=${encodeURIComponent(this.runtime.jupyter.token)}`;
    }

    private isJupyterHttpReady(hostPort: number, timeoutMs: number): Promise<boolean>{
        return new Promise((resolve) => {
            const req = http.request({
                host: '127.0.0.1',
                port: hostPort,
                path: `/api?token=${encodeURIComponent(this.runtime.jupyter.token)}`,
                method: 'GET',
                timeout: timeoutMs
            }, (res) => {
                res.resume();
                resolve(Boolean(res.statusCode && res.statusCode < 500));
            });

            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.on('error', () => resolve(false));
            req.end();
        });
    }

    private async waitForJupyterHttpReady(hostPort: number, timeoutMs: number): Promise<boolean>{
        const deadline = Date.now() + Math.max(timeoutMs, 0);

        while(Date.now() < deadline){
            if(await this.isJupyterHttpReady(hostPort, 1000)) return true;
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        return this.isJupyterHttpReady(hostPort, 1000);
    }

    private getStartCommand(): string{
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
