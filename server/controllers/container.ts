import { execSync } from 'child_process';
import { Request, Response, NextFunction, RequestHandler } from 'express';

import { Socket } from 'socket.io';
import { Container, Team } from '@/models/index';
import { dockerService } from '@/services/docker';
import { terminalManager } from '@/services/terminal';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { catchAsync } from '@/utilities/runtime/runtime';

export default class ContainerController {
    public getAllContainers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const userTeams = await Team.find({ members: (req.user as any)._id });
        const teamIds = userTeams.map((t) => t._id);

        const containers = await Container.find({
            $or: [
                { team: { $in: teamIds } },
                { team: null, createdBy: (req.user as any)._id },
                { team: { $exists: false }, createdBy: (req.user as any)._id }
            ]
        })
            .populate('team', 'name')
            .populate('createdBy', 'firstName lastName email');

        const syncedContainers = await Promise.all(containers.map(async (doc) => {
            try {
                const info = await dockerService.inspectContainer(doc.containerId);
                if (info.State.Status !== doc.status) {
                    doc.status = info.State.Status;
                    await doc.save();
                }
            } catch (e) {
                doc.status = 'missing';
                await doc.save();
            }
            return doc;
        }));

        res.status(200).json({ status: 'success', data: { containers: syncedContainers } });
    });

    public createContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd } = req.body;
        const team = res.locals.team;

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

        // Determine container command
        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;

        // Only fallback to tail -f /dev/null if not using image default command
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
                // Determine the docker group ID on the host
                const dockerGid = execSync("getent group docker | cut -d: -f3").toString().trim();
                // Add the group to the container so the user has access to the socket
                if (dockerGid) {
                    HostConfig.GroupAdd = [dockerGid];
                }
            } catch (e) {
                console.warn('Could not detect docker group ID to create permissions for socket mount. Container might fail to access docker.sock:', e);
            }
        }

        const dockerConfig = {
            Image: image,
            name: `${name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig,
            Tty: true,
            Cmd: containerCmd,
            // For Coder/sysbox scenarios we might need creating container with specific user/group
            // but standard docker socket mount is usually sufficient for "dind" like usage if user is root inside
            // or docker group matches.
        } as any;

        const dockerContainer = await dockerService.createContainer(dockerConfig);
        const containerInfo = await dockerContainer.inspect();

        const newContainer = await Container.create({
            name,
            image,
            containerId: containerInfo.Id,
            team: team._id,
            status: containerInfo.State.Status,
            env: env || [],
            ports: ports || [],
            memory: req.body.memory || 512,
            cpus: req.body.cpus || 1,
            createdBy: (req.user as any)._id
        });

        await Team.findByIdAndUpdate(team._id, { $push: { containers: newContainer._id } });

        res.status(201).json({ status: 'success', data: { container: newContainer } });
    });

    public controlContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { action } = req.body;
        const container = res.locals.container;

        if (action === 'start') {
            await dockerService.startContainer(container.containerId);
        } else if (action === 'stop') {
            await dockerService.stopContainer(container.containerId);
        } else {
            return next(new RuntimeError(ErrorCodes.CONTAINER_INVALID_ACTION, 400));
        }

        const info = await dockerService.inspectContainer(container.containerId);
        container.status = info.State.Status;
        await container.save();

        res.status(200).json({ status: 'success', data: { container } });
    });

    public deleteContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;

        await dockerService.stopContainer(container.containerId);
        await dockerService.removeContainer(container.containerId);
        await container.deleteOne();

        res.status(204).json({ status: 'success', data: null });
    });

    public getContainerStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;

        const stats = await dockerService.getContainerStats(container.containerId);
        const limits = {
            memory: container.memory * 1024 * 1024,
            cpus: container.cpus
        };

        res.status(200).json({ status: 'success', data: { stats, limits } });
    });

    public restartContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;

        await dockerService.stopContainer(container.containerId);
        await dockerService.startContainer(container.containerId);

        container.status = 'running';
        await container.save();

        res.status(200).json({ status: 'success', data: { container } });
    });

    public getContainerFiles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { path = '/' } = req.query;
        const container = res.locals.container;

        const output = await dockerService.execCommand(container.containerId, ['ls', '-la', String(path)]);
        const lines = output.split('\n').slice(1);
        const files = lines.map((line: string) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 9) return null;

            const isDir = parts[0].startsWith('d');
            const name = parts.slice(8).join(' ');
            if (name === '.' || name === '..') return null;

            return {
                name,
                isDirectory: isDir,
                size: parts[4],
                permissions: parts[0],
                updatedAt: `${parts[5]} ${parts[6]} ${parts[7]}`
            };
        }).filter(Boolean);

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

    public updateContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { env, ports } = req.body;
        const container = res.locals.container;

        try {
            await dockerService.stopContainer(container.containerId);
            await dockerService.removeContainer(container.containerId);
        } catch (e) {
            /* container may already be gone */
        }

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
            Image: container.image,
            name: `${container.name.replace(/\s+/g, '-')}-${Date.now()}`,
            Env,
            ExposedPorts,
            HostConfig: {
                PortBindings,
                Memory: (req.body.memory || container.memory || 512) * 1024 * 1024,
                NanoCpus: (req.body.cpus || container.cpus || 1) * 1_000_000_000
            },
            Tty: true,
            Cmd: ['tail', '-f', '/dev/null']
        } as any;

        const dockerContainer = await dockerService.createContainer(dockerConfig);
        const containerInfo = await dockerContainer.inspect();

        container.containerId = containerInfo.Id;
        container.status = containerInfo.State.Status;
        container.env = env || [];
        container.ports = ports || [];
        if (req.body.memory) container.memory = req.body.memory;
        if (req.body.cpus) container.cpus = req.body.cpus;
        await container.save();

        res.status(200).json({ status: 'success', data: { container } });
    });
}
