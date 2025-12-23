/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Request, Response } from 'express';
import SSHService from '@/services/ssh';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { catchAsync } from '@/utilities/runtime/runtime';
import { v4 } from 'uuid';
import logger from '@/logger';
import { ErrorCodes } from '@/constants/error-codes';
import { getSSHImportQueue } from '@/queues';

export default class SSHFileExplorerController{
    public listSSHFiles = catchAsync(async(req: Request, res: Response) => {
        const { path } = req.query;
        const connection = res.locals.sshConnection;

        try{
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
        }catch(err: any){
            if(err instanceof RuntimeError){
                throw err;
            }
            logger.error(`Failed to list SSH files: ${err.message}`);
            throw new RuntimeError(ErrorCodes.SSH_LIST_FILES_ERROR, 500);
        }
    });

    public importTrajectoryFromSSH = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const { connectionId, remotePath, teamId } = req.body;
        const { sshConnection } = res.locals;

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
    });
}
