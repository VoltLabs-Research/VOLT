/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import { Request, Response } from 'express';
import SSHConnection from '@/models/ssh-connection';
import SSHService from '@/services/ssh';
import RuntimeError from '@/utilities/runtime-error';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import * as os from 'node:os';
import { Types } from 'mongoose';
import { createTrajectoryFromProcessedFiles, processLocalDumpFiles } from '@/utilities/trajectory-processing';
import logger from '@/logger';
import { readdir } from 'fs/promises';

export const listSSHFiles = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;
    const { connectionId, path } = req.query;

    if (!connectionId || typeof connectionId !== 'string') {
        throw new RuntimeError('SSH::ConnectionId::Required', 400);
    }

    try {
        const connection = await SSHConnection.findOne({
            _id: connectionId,
            user: userId
        }).select('+encryptedPassword');

        if (!connection) {
            throw new RuntimeError('SSHConnection::NotFound', 404);
        }

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

export const importTrajectoryFromSSH = async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user) {
        throw new RuntimeError('Unauthorized', 401);
    }

    const userId = user._id || user.id;
    const { connectionId, remotePath, teamId, name } = req.body;

    if (!connectionId || !remotePath || !teamId) {
        throw new RuntimeError('SSH::Import::MissingFields', 400);
    }

    const trajectoryId = new Types.ObjectId();
    const trajectoryIdStr = trajectoryId.toString();
    const tempBaseDir = join(os.tmpdir(), 'opendxa-trajectories');
    const localFolder = join(tempBaseDir, trajectoryIdStr);

    try {
        const connection = await SSHConnection.findOne({
            _id: connectionId,
            user: userId
        }).select('+encryptedPassword');

        if (!connection) {
            throw new RuntimeError('SSHConnection::NotFound', 404);
        }

        await mkdir(localFolder, { recursive: true });

        // Get file stats to determine if it's a file or directory
        const fileStats = await SSHService.getFileStats(connection, remotePath);

        if (!fileStats) {
            throw new RuntimeError('SSH::Path::NotFound', 404);
        }

        let localFiles: string[] = [];

        if (fileStats.isDirectory) {
            // Download entire directory
            logger.info(`Downloading directory from SSH: ${remotePath}`);
            localFiles = await SSHService.downloadDirectory(connection, remotePath, localFolder);
        } else {
            // Download single file
            logger.info(`Downloading file from SSH: ${remotePath}`);
            const localFilePath = join(localFolder, fileStats.name);
            await SSHService.downloadFile(connection, remotePath, localFilePath);
            localFiles = [localFilePath];
        }

        if (localFiles.length === 0) {
            await rm(localFolder, { recursive: true, force: true });
            throw new RuntimeError('SSH::Import::NoFiles', 400);
        }

        // Filter only dump files (typically .dump, .lammpstrj, or no extension)
        const dumpFiles = localFiles.filter(file => {
            const ext = file.split('.').pop()?.toLowerCase();
            return !ext || ext === 'dump' || ext === 'lammpstrj' || ext === 'lammps';
        });

        if (dumpFiles.length === 0) {
            await rm(localFolder, { recursive: true, force: true });
            throw new RuntimeError('SSH::Import::NoDumpFiles', 400);
        }

        logger.info(`Processing ${dumpFiles.length} dump files from SSH`);

        // Process dump files
        const processedFiles = await processLocalDumpFiles(dumpFiles, trajectoryIdStr, localFolder);

        if (processedFiles.length === 0) {
            await rm(localFolder, { recursive: true, force: true });
            throw new RuntimeError('Trajectory::NoValidFiles', 400);
        }

        // Create trajectory using shared utility
        const trajectoryName = name || fileStats.name || 'SSH Import';
        const newTrajectory = await createTrajectoryFromProcessedFiles({
            name: trajectoryName,
            teamId,
            userId,
            processedFiles,
            folderPath: localFolder
        });

        res.status(201).json({
            status: 'success',
            data: newTrajectory
        });
    } catch (err: any) {
        // Clean up on error
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
    }
};
