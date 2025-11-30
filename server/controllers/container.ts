import { Request, Response, NextFunction } from 'express';
import { Container, Team } from '@/models/index';
import { dockerService } from '@/services/docker';
import RuntimeError from '@/utilities/runtime-error';
import { catchAsync } from '@/utilities/runtime';
import { Socket } from 'socket.io';

export const getAllContainers = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    // Get containers for teams the user is part of
    const userTeams = await Team.find({ members: (req.user as any)._id });
    const teamIds = userTeams.map(t => t._id);

    const containers = await Container.find({ team: { $in: teamIds } })
        .populate('team', 'name')
        .populate('createdBy', 'firstName lastName email');

    // Sync status with Docker
    const syncedContainers = await Promise.all(containers.map(async (doc) => {
        try {
            const info = await dockerService.inspectContainer(doc.containerId);
            if (info.State.Status !== doc.status) {
                doc.status = info.State.Status;
                await doc.save();
            }
        } catch (e) {
            // Container might be gone from Docker
            doc.status = 'missing';
            await doc.save();
        }
        return doc;
    }));

    res.status(200).json({
        status: 'success',
        data: {
            containers: syncedContainers
        }
    });
});

export const createContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { name, image, teamId, env, ports } = req.body;

    // Verify team membership
    const team = await Team.findOne({ _id: teamId, members: (req.user as any)._id });
    if (!team) {
        return next(new RuntimeError('Container::Team::AccessDenied', 403));
    }

    // Format env vars for Docker
    const Env = env ? env.map((e: any) => `${e.key}=${e.value}`) : [];

    // Format ports for Docker
    const PortBindings: any = {};
    const ExposedPorts: any = {};
    if (ports) {
        ports.forEach((p: any) => {
            const portKey = `${p.private}/tcp`;
            ExposedPorts[portKey] = {};
            PortBindings[portKey] = [{ HostPort: String(p.public) }];
        });
    }

    const dockerConfig = {
        Image: image,
        name: `${name.replace(/\s+/g, '-')}-${Date.now()}`, // Ensure unique name
        Env,
        ExposedPorts,
        HostConfig: {
            PortBindings
        },
        Tty: true,
        Cmd: ['tail', '-f', '/dev/null']
    };

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
        createdBy: (req.user as any)._id
    });

    // Add to team
    await Team.findByIdAndUpdate(team._id, { $push: { containers: newContainer._id } });

    res.status(201).json({
        status: 'success',
        data: {
            container: newContainer
        }
    });
});

export const controlContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { action } = req.body; // start, stop

    const container = await Container.findById(id);
    if (!container) {
        return next(new RuntimeError('Container::NotFound', 404));
    }

    // Verify access
    const team = await Team.findOne({ _id: container.team, members: (req.user as any)._id });
    if (!team) {
        return next(new RuntimeError('Container::AccessDenied', 403));
    }

    if (action === 'start') {
        await dockerService.startContainer(container.containerId);
    } else if (action === 'stop') {
        await dockerService.stopContainer(container.containerId);
    } else {
        return next(new RuntimeError('Container::InvalidAction', 400));
    }

    const info = await dockerService.inspectContainer(container.containerId);
    container.status = info.State.Status;
    await container.save();

    res.status(200).json({
        status: 'success',
        data: {
            container
        }
    });
});

export const deleteContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const container = await Container.findById(id);
    if (!container) {
        return next(new RuntimeError('Container::NotFound', 404));
    }

    // Verify access
    const team = await Team.findOne({ _id: container.team, members: (req.user as any)._id });
    if (!team) {
        return next(new RuntimeError('Container::AccessDenied', 403));
    }

    // Stop and remove from Docker
    await dockerService.stopContainer(container.containerId);
    await dockerService.removeContainer(container.containerId);

    // Remove from DB
    await container.deleteOne();

    res.status(204).json({
        status: 'success',
        data: null
    });
});

export const getContainerStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const container = await Container.findById(id);
    if (!container) return next(new RuntimeError('Container::NotFound', 404));

    const stats = await dockerService.getContainerStats(container.containerId);
    res.status(200).json({
        status: 'success',
        data: { stats }
    });
});

export const restartContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const container = await Container.findById(id);
    if (!container) return next(new RuntimeError('Container::NotFound', 404));

    // Verify access
    const team = await Team.findOne({ _id: container.team, members: (req.user as any)._id });
    if (!team) return next(new RuntimeError('Container::AccessDenied', 403));

    await dockerService.stopContainer(container.containerId);
    await dockerService.startContainer(container.containerId);

    container.status = 'running';
    await container.save();

    res.status(200).json({
        status: 'success',
        data: { container }
    });
});

export const getContainerFiles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { path = '/' } = req.query;

    const container = await Container.findById(id);
    if (!container) return next(new RuntimeError('Container::NotFound', 404));

    // Verify access
    const team = await Team.findOne({ _id: container.team, members: (req.user as any)._id });
    if (!team) return next(new RuntimeError('Container::AccessDenied', 403));

    // Use ls -la to get file details
    // Format: permissions links owner group size date time name
    const output = await dockerService.execCommand(container.containerId, ['ls', '-la', String(path)]);

    // Parse output (simplified)
    const lines = output.split('\n').slice(1); // Skip total line
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

    res.status(200).json({
        status: 'success',
        data: { files }
    });
});

export const readContainerFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
        return next(new RuntimeError('Container::File::PathRequired', 400));
    }

    const container = await Container.findById(id);
    if (!container) return next(new RuntimeError('Container::NotFound', 404));

    // Verify access
    const team = await Team.findOne({ _id: container.team, members: (req.user as any)._id });
    if (!team) return next(new RuntimeError('Container::AccessDenied', 403));

    const content = await dockerService.execCommand(container.containerId, ['cat', path]);

    res.status(200).json({
        status: 'success',
        data: { content }
    });
});

import { terminalManager } from '@/services/terminal';

// WebSocket handler for terminal
export const handleContainerTerminal = (socket: Socket) => {
    socket.on('container:terminal:attach', async (data: { containerId: string }) => {
        await terminalManager.attach(socket, data.containerId);
    });
};

export const updateContainer = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { env, ports } = req.body;

    const container = await Container.findById(id);
    if (!container) return next(new RuntimeError('Container::NotFound', 404));

    // Verify access
    const team = await Team.findOne({ _id: container.team, members: (req.user as any)._id });
    if (!team) return next(new RuntimeError('Container::AccessDenied', 403));

    // 1. Stop and remove old container
    try {
        await dockerService.stopContainer(container.containerId);
        await dockerService.removeContainer(container.containerId);
    } catch (e) {
        // Ignore errors if container is already gone
    }

    // 2. Prepare new config
    const Env = env ? env.map((e: any) => `${e.key}=${e.value}`) : [];
    const PortBindings: any = {};
    const ExposedPorts: any = {};

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
            PortBindings
        },
        Tty: true,
        Cmd: ['tail', '-f', '/dev/null']
    };

    // 3. Create new container
    const dockerContainer = await dockerService.createContainer(dockerConfig);
    const containerInfo = await dockerContainer.inspect();

    // 4. Update DB
    container.containerId = containerInfo.Id;
    container.status = containerInfo.State.Status;
    container.env = env || [];
    container.ports = ports || [];
    await container.save();

    res.status(200).json({
        status: 'success',
        data: { container }
    });
});
