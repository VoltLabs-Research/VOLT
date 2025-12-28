import { execSync } from 'child_process';
import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { Container } from '@/models/index';
import { dockerService } from '@/services/docker';
import { terminalManager } from '@/services/terminal';
import { Resource } from '@/constants/resources';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { catchAsync } from '@/utilities/runtime/runtime';
import BaseController from '@/controllers/base-controller';

export default class ContainerController extends BaseController<any> {
    constructor() {
        super(Container, {
            resource: Resource.CONTAINER,
            fields: ['name', 'image', 'status', 'team', 'env', 'ports', 'memory', 'cpus', 'internalIp']
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

        // Create named volume for data persistence
        const volumeName = `volterra-${name.replace(/\s+/g, '-').toLowerCase()}-data`;
        HostConfig.Binds = HostConfig.Binds || [];
        HostConfig.Binds.push(`${volumeName}:/data`);

        if (mountDockerSocket) {
            HostConfig.Binds.push('/var/run/docker.sock:/var/run/docker.sock');
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
        await dockerContainer.start();

        // Create Docker network for container
        const networkName = `volterra-${name.replace(/\s+/g, '-').toLowerCase()}-net`;
        const network = await dockerService.createNetwork(networkName);

        const volume = await dockerService.createVolume(volumeName);

        // Connect container to network
        await dockerService.connectContainerToNetwork(dockerContainer.id, network.id);

        // Re-inspect to get IP after network connection
        const containerInfo = await dockerContainer.inspect();
        const internalIp = containerInfo.NetworkSettings?.Networks?.[networkName]?.IPAddress || null;

        // Create MongoDB network document (will be linked after container is created)
        const { DockerNetwork, DockerVolume } = await import('@/models');
        const networkDoc = await DockerNetwork.create({
            networkId: network.id,
            name: networkName,
            driver: 'bridge'
        });

        // Create MongoDB volume document
        const volumeDoc = await DockerVolume.create({
            volumeId: volume.id,
            name: volumeName,
            driver: 'local'
        });

        return {
            ...data,
            team: await this.getTeamId(req),
            containerId: containerInfo.Id,
            internalIp,
            network: networkDoc._id,
            volume: volumeDoc._id,
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

        // Commit current container to temporary image to preserve filesystem changes
        const tempImageName = `volterra-temp-${currentDoc.name.replace(/\s+/g, '-').toLowerCase()}:${Date.now()}`;
        try {
            const oldContainer = dockerService.getContainer(currentDoc.containerId);
            await oldContainer.commit({
                repo: tempImageName.split(':')[0],
                tag: tempImageName.split(':')[1]
            });
        } catch (e) {
            console.warn('Could not commit container, using original image:', e);
        }

        // Stop and remove old container (volumes are preserved)
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

        // Reuse volume to preserve data
        const volumeName = `volterra-${currentDoc.name.replace(/\s+/g, '-').toLowerCase()}-data`;

        const dockerConfig = {
            Image: tempImageName || currentDoc.image,
            name: `${currentDoc.name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig: {
                PortBindings,
                Memory: currentDoc.memory * 1024 * 1024,
                NanoCpus: currentDoc.cpus * 1_000_000_000,
                Binds: [`${volumeName}:/data`]
            },
            Tty: true
        } as any;

        const dockerContainer = await dockerService.createContainer(dockerConfig);
        await dockerContainer.start();

        // Reconnect to network
        if (currentDoc.network) {
            const { DockerNetwork } = await import('@/models');
            const networkDoc = await DockerNetwork.findById(currentDoc.network);
            if (networkDoc?.networkId) {
                await dockerService.connectContainerToNetwork(dockerContainer.id, networkDoc.networkId);
            }
        }

        const containerInfo = await dockerContainer.inspect();
        const networkName = currentDoc.network ? `volterra-${currentDoc.name.replace(/\s+/g, '-').toLowerCase()}-net` : undefined;
        const internalIp = networkName && containerInfo.NetworkSettings?.Networks?.[networkName]?.IPAddress || null;

        return {
            ...data,
            containerId: containerInfo.Id,
            internalIp,
            status: containerInfo.State.Status
        };
    }

    protected async onBeforeDelete(doc: any, req: Request): Promise<void> {
        try {
            await dockerService.stopContainer(doc.containerId);
            await dockerService.removeContainer(doc.containerId);

            // Delete Docker network (cascade delete will handle MongoDB cleanup)
            if (doc.network) {
                const { DockerNetwork } = await import('@/models');
                const networkDoc = await DockerNetwork.findById(doc.network);
                if (networkDoc?.networkId) {
                    await dockerService.removeNetwork(networkDoc.networkId);
                }
            }
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
