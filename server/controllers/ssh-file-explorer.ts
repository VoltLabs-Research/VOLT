import { Request, Response } from 'express';
import SSHService from '@/services/ssh';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { catchAsync } from '@/utilities/runtime/runtime';
import { v4 } from 'uuid';
import logger from '@/logger';
import { ErrorCodes } from '@/constants/error-codes';
import { Action, Resource } from '@/constants/permissions';
import { getSSHImportQueue } from '@/queues';
import { Trajectory } from '@/models';
import BaseController from '@/controllers/base-controller';

export default class SSHFileExplorerController extends BaseController<any> {
    constructor() {
        super(Trajectory, {
            resourceName: 'SSHFileExplorer',
            resource: Resource.TRAJECTORY
        });
    }

    public listSSHFiles = catchAsync(async (req: Request, res: Response) => {
        const { path } = req.query;
        const connection = res.locals.sshConnection;

        try {
            const remotePath = typeof path === 'string' ? path : '.';
            const files = await SSHService.listFiles(connection, remotePath);

            res.status(200).json({
                status: 'success',
                data: {
                    cwd: remotePath,
                    entries: files.map(f => ({
                        type: f.isDirectory ? 'dir' : 'file',
                        name: f.name,
                        relPath: f.path,
                        size: f.size,
                        mtime: f.mtime.toISOString()
                    }))
                }
            });
        } catch (err: any) {
            if (err instanceof RuntimeError) throw err;
            logger.error(`Failed to list SSH files: ${err.message}`);
            throw new RuntimeError(ErrorCodes.SSH_LIST_FILES_ERROR, 500);
        }
    });

    public importTrajectoryFromSSH = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const teamId = await this.getTeamId(req);
        const { connectionId, remotePath } = req.body;
        const { sshConnection } = res.locals;

        await this.authorize(req, teamId, Action.CREATE);

        const queueService = getSSHImportQueue();
        queueService.addJobs([{
            jobId: v4(),
            sessionId: v4(),
            teamId,
            name: 'Import Trajectory',
            message: `From ${sshConnection.username}@${sshConnection.host}`,
            sshConnectionId: connectionId,
            remotePath,
            userId
        }]);

        res.status(202).json({
            status: 'success',
            message: 'Import job queued'
        });
    });
}
