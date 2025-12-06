/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
import SSHConnection from '@/models/ssh-connection';
import SSHService from '@/services/ssh';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import * as os from 'node:os';
import { Types } from 'mongoose';
import { v4 } from 'uuid';
import { createRedisClient } from '@/config/redis';
import createTrajectory from '@/utilities/create-trajectory';
import logger from '@/logger';
import path from 'path';

export default class SSHFileExplorerController {
    public listSSHFiles = async (req: Request, res: Response) => {
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
            if (err instanceof RuntimeError) {
                throw err;
            }
            logger.error(`Failed to list SSH files: ${err.message}`);
            throw new RuntimeError('SSH::ListFiles::Error', 500);
        }
    };

    public importTrajectoryFromSSH = async (req: Request, res: Response) => {
        const userId = (req as any).user._id || (req as any).user.id;
        const { remotePath, teamId, name } = req.body;
        const connection = res.locals.sshConnection;

        const trajectoryId = new Types.ObjectId();
        const trajectoryIdStr = trajectoryId.toString();
        const tempBaseDir = join(os.tmpdir(), 'opendxa-trajectories');
        const localFolder = join(tempBaseDir, trajectoryIdStr);

        const publisher = createRedisClient();
        const jobId = v4();
        const sessionId = v4();
        const sessionStartTime = new Date().toISOString();

        const publishProgress = async (status: string, progress: number, message?: string) => {
            const payload = {
                jobId,
                status,
                progress,
                chunkIndex: 0,
                totalChunks: 1,
                name: 'SSH Import',
                message: message || `Importing ${name || 'trajectory'}...`,
                trajectoryId: trajectoryIdStr,
                sessionId,
                sessionStartTime,
                timestamp: new Date().toISOString(),
                queueType: 'ssh-import',
                type: 'ssh_import'
            };

            await publisher.publish('job_updates', JSON.stringify({ teamId, payload }));

            const pipeline = publisher.pipeline();
            pipeline.sadd(`team:${teamId}:jobs`, jobId);
            pipeline.setex(`ssh-import:status:${jobId}`, 3600, JSON.stringify({ ...payload, teamId }));
            await pipeline.exec();
        };

        try {
            await mkdir(localFolder, { recursive: true });

            publishProgress('running', 0, 'Connecting to SSH server...');

            const fileStats = await SSHService.getFileStats(connection, remotePath);

            if (!fileStats) {
                throw new RuntimeError('SSH::Path::NotFound', 404);
            }

            let localFiles: string[] = [];
            const trajectoryName = name || fileStats.name || 'SSH Import';

            publishProgress('running', 5, 'Downloading files...');

            if (fileStats.isDirectory) {
                logger.info(`Downloading directory from SSH: ${remotePath}`);
                localFiles = await SSHService.downloadDirectory(
                    connection,
                    remotePath,
                    localFolder,
                    (progress) => {
                        const percentage = 5 + Math.round((progress.downloaded / progress.total) * 75);
                        publishProgress(
                            'running',
                            percentage,
                            `Downloading: ${progress.currentFile} (${Math.round(progress.downloaded / 1024 / 1024)}MB / ${Math.round(progress.total / 1024 / 1024)}MB)`
                        );
                    }
                );
            } else {
                logger.info(`Downloading file from SSH: ${remotePath}`);
                const localFilePath = join(localFolder, fileStats.name);
                await SSHService.downloadFile(connection, remotePath, localFilePath);
                localFiles = [localFilePath];
                publishProgress('running', 80, 'Download complete');
            }

            if (localFiles.length === 0) {
                await rm(localFolder, { recursive: true, force: true });
                throw new RuntimeError('SSH::Import::NoFiles', 400);
            }

            publishProgress('running', 85, 'Processing files...');

            const filesToProcess = localFiles.map(filePath => ({
                path: filePath,
                originalname: path.basename(filePath),
                size: 0
            }));

            const newTrajectory = await createTrajectory(
                filesToProcess,
                teamId,
                userId.toString(),
                trajectoryName
            );

            publishProgress('completed', 100, 'Import successful');

            res.status(201).json({
                status: 'success',
                data: newTrajectory
            });
        } catch (err: any) {
            publishProgress('failed', 0, err.message || 'Import failed');

            try {
                await rm(localFolder, { recursive: true, force: true });
            } catch (cleanupErr) {
                logger.error(`Failed to cleanup after SSH import error: ${cleanupErr}`);
            }

            if (err instanceof RuntimeError) {
                throw err;
            }
            logger.error(`Failed to import trajectory from SSH: ${err.message}`);
            throw new RuntimeError('SSH::Import::Error', 500);
        } finally {
            publisher.quit();
        }
    };
}
