import { Request, Response, NextFunction } from 'express';
import { Socket } from 'socket.io';
import { Container } from '@/models/index';
import { terminalManager } from '@/services/docker/terminal';
import containerService from '@/services/docker/container';
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
        const userId = (req as any).user._id;
        const teamId = await this.getTeamId(req);
        return await containerService.createContainer(req.body, userId, teamId);
    }

    protected async onBeforeUpdate(data: Partial<any>, req: Request, currentDoc: any): Promise<Partial<any>> {
        return await containerService.updateContainer(req.body, currentDoc);
    }

    protected async onBeforeDelete(doc: any, req: Request): Promise<void> {
        await containerService.deleteContainer(doc);
    }

    public getContainerStats = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;
        const data = await containerService.getStats(container);

        res.status(200).json({
            status: 'success',
            data
        });
    });

    public getContainerFiles = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { path = '/' } = req.query;
        const container = res.locals.container;

        const files = await containerService.getFiles(container, String(path));

        res.status(200).json({ status: 'success', data: { files } });
    });

    public readContainerFile = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const { path } = req.query;
        if (!path || typeof path !== 'string') return next(new RuntimeError(ErrorCodes.CONTAINER_FILE_PATH_REQUIRED, 400));

        const container = res.locals.container;
        const content = await containerService.readFile(container, path);

        res.status(200).json({ status: 'success', data: { content } });
    });

    public getContainerProcesses = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const container = res.locals.container;
        const processes = await containerService.getProcesses(container);

        res.status(200).json({ status: 'success', data: { processes } });
    });

    public handleContainerTerminal = (socket: Socket) => {
        socket.on('container:terminal:attach', async (data: { containerId: string }) => {
            await terminalManager.attach(socket, data.containerId);
        });
    };
}
