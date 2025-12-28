import { execSync } from 'child_process';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { Container } from '@/models/index';
import { dockerService } from '@/services/docker';
import { terminalManager } from '@/services/terminal';
import { Resource } from '@/constants/resources';
import { Action } from '@/constants/permissions';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { catchAsync } from '@/utilities/runtime/runtime';
import BaseController from '@/controllers/base-controller';

export default class ContainerController extends BaseController<any> {
    constructor() {
        super(Container, {
            resource: Resource.CONTAINER,
            fields: ['name', 'image', 'status', 'team', 'env', 'ports', 'memory', 'cpus']
        });
    }

    protected async getFilter(req: Request): Promise<any> {
        const teamId = await this.getTeamId(req);
        return { team: teamId };
    }

    protected async onBeforeCreate(data: Partial<any>, req: Request): Promise<Partial<any>> {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd } = req.body;

        const Env = env ? env.map((e: any) => `${e.key}=${e.value}`) : [];
        const PortBindings: Record<string, any> = {};
        const ExposedPorts: Record<string, any> = {};

        if (ports) {
            ports.forEach((p: any) => {
                const portKey = `${p.private}/tcp`;
                ExposedPorts[portKey] = {};
                PortBindings[portKey] = [{ HostPort: String(p.public) }];
            });
        }

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const HostConfig: any = {
            PortBindings,
            Memory: (req.body.memory || 512) * 1024 * 1024,
            NanoCpus: (req.body.cpus || 1) * 1_000_000_000
        };

        if (mountDockerSocket) {
            HostConfig.Binds = ['/var/run/docker.sock:/var/run/docker.sock'];
            try {
                const dockerGid = execSync("getent group docker | cut -d: -f3").toString().trim();
                if (dockerGid) HostConfig.GroupAdd = [dockerGid];
            } catch (e) {
                console.warn('Could not detect docker group ID:', e);
            }
        }

        const dockerConfig = {
            Image: image,
            name: `${name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig,
            Tty: true,
            Cmd: containerCmd
        } as any;

        const dockerContainer = await dockerService.createContainer(dockerConfig);
        const containerInfo = await dockerContainer.inspect();

        return {
            ...data,
            team: await this.getTeamId(req),
            containerId: containerInfo.Id,
            status: containerInfo.State.Status,
            createdBy: (req as any).user._id
        };
    }

    protected async onBeforeUpdate(data: Partial<any>, req: Request, currentDoc: any): Promise<Partial<any>> {
        const { action, env, ports } = req.body;

        if (action) {
            if (action === 'start') {
                await dockerService.startContainer(currentDoc.containerId);
            } else if (action === 'stop') {
                await dockerService.stopContainer(currentDoc.containerId);
            } else if (action === 'restart') {
                await dockerService.stopContainer(currentDoc.containerId);
                await dockerService.startContainer(currentDoc.containerId);
            }

            const info = await dockerService.inspectContainer(currentDoc.containerId);
            return { ...data, status: info.State.Status };
        }

        // Stop and remove old container
        try {
            await dockerService.stopContainer(currentDoc.containerId);
            await dockerService.removeContainer(currentDoc.containerId);
        } catch (e) { /* container may be gone */ }

        const Env = env ? env.map((e: any) => `${e.key}=${e.value}`) : [];
        const PortBindings: Record<string, any> = {};
        const ExposedPorts: Record<string, any> = {};

        if (ports) {
            ports.forEach((p: any) => {
                const portKey = `${p.private}/tcp`;
                ExposedPorts[portKey] = {};
                PortBindings[portKey] = [{ HostPort: String(p.public) }];
            });
        }

        const dockerConfig = {
            Image: currentDoc.image,
            name: `${currentDoc.name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig: {
                PortBindings,
                Memory: currentDoc.memory * 1024 * 1024,
                NanoCpus: currentDoc.cpus * 1_000_000_000
            },
            Tty: true
        } as any;

        const dockerContainer = await dockerService.createContainer(dockerConfig);
        const containerInfo = await dockerContainer.inspect();

        return {
            ...data,
            containerId: containerInfo.Id,
            status: containerInfo.State.Status
        };
    }

    protected async onBeforeDelete(doc: any, req: Request): Promise<void> {
        try {
            await dockerService.stopContainer(doc.containerId);
            await dockerService.removeContainer(doc.containerId);
        } catch (e) {
            /* ignore if already removed */
        }
    }

    public getContainerStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;

        const stats = await dockerService.getContainerStats(container.containerId);
        res.status(200).json({
            status: 'success',
            data: {
                stats,
                limits: { memory: container.memory * 1024 * 1024, cpus: container.cpus }
            }
        });
    });

    public getContainerFiles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { path = '/' } = req.query;
        const container = res.locals.container;

        const output = await dockerService.execCommand(container.containerId, ['ls', '-la', String(path)]);
        const lines = output.split('\n').slice(1);
        const files = lines.map((line: string) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 9) return null;
            return {
                name: parts.slice(8).join(' '),
                isDirectory: parts[0].startsWith('d'),
                size: parts[4],
                permissions: parts[0],
                updatedAt: `${parts[5]} ${parts[6]} ${parts[7]}`
            };
        }).filter(Boolean).filter((f: any) => f.name !== '.' && f.name !== '..');

        res.status(200).json({ status: 'success', data: { files } });
    });

    public readContainerFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { path } = req.query;
        if (!path || typeof path !== 'string') return next(new RuntimeError(ErrorCodes.CONTAINER_FILE_PATH_REQUIRED, 400));

        const container = res.locals.container;

        const content = await dockerService.execCommand(container.containerId, ['cat', path]);
        res.status(200).json({ status: 'success', data: { content } });
    });

    public getContainerProcesses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;

        const processes = await dockerService.getContainerProcesses(container.containerId);
        res.status(200).json({ status: 'success', data: { processes } });
    });

    public handleContainerTerminal = (socket: Socket) => {
        socket.on('container:terminal:attach', async (data: { containerId: string }) => {
            await terminalManager.attach(socket, data.containerId);
        });
    };
}
