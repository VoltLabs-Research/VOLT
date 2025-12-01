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

import { Types } from 'mongoose';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import * as os from 'node:os';
import { Trajectory } from '@/models';
import { getTrajectoryProcessingQueue } from '@/queues';
import TrajectoryVFS from '@/services/trajectory-vfs';
import { processTrajectoryFile } from '@/utilities/lammps';
import { v4 } from 'uuid';
import logger from '@/logger';

export interface ProcessedFile {
    frameData: any;
    srcPath: string;
    originalSize: number;
    originalName: string;
}

export interface CreateTrajectoryParams {
    name: string;
    teamId: string;
    userId: string;
    processedFiles: ProcessedFile[];
    folderPath: string;
}

/**
 * Create trajectory document and queue processing jobs
 * This is shared between upload and SSH import flows
 */
export const createTrajectoryFromProcessedFiles = async (params: CreateTrajectoryParams) => {
    const { name, teamId, userId, processedFiles, folderPath } = params;

    const trajectoryId = new Types.ObjectId();
    const totalSize = processedFiles.reduce((acc, f) => acc + f.originalSize, 0);
    const frames = processedFiles.map(f => f.frameData);

    const newTrajectory = await Trajectory.create({
        _id: trajectoryId,
        name,
        team: teamId,
        createdBy: userId,
        frames,
        status: 'processing',
        stats: {
            totalFiles: processedFiles.length,
            totalSize
        }
    });

    const trajectoryProcessingQueue = getTrajectoryProcessingQueue();
    const CHUNK_SIZE = 20;
    const jobs: any[] = [];

    for (let i = 0; i < processedFiles.length; i += CHUNK_SIZE) {
        const chunk = processedFiles.slice(i, i + CHUNK_SIZE);
        jobs.push({
            jobId: v4(),
            trajectoryId: newTrajectory._id.toString(),
            chunkIndex: Math.floor(i / CHUNK_SIZE),
            totalChunks: Math.ceil(processedFiles.length / CHUNK_SIZE),
            files: chunk.map(({ frameData, srcPath }) => ({
                frameData,
                frameFilePath: srcPath
            })),
            teamId,
            name: 'Upload Trajectory',
            message: name,
            folderPath,
            tempFolderPath: folderPath
        });
    }

    // Add all jobs at once to ensure they share the same sessionId
    trajectoryProcessingQueue.addJobs(jobs);

    return newTrajectory;
};

/**
 * Process dump files from local paths
 * Returns array of processed files ready for trajectory creation
 */
export const processLocalDumpFiles = async (
    filePaths: string[],
    trajectoryId: string,
    folderPath: string
): Promise<ProcessedFile[]> => {
    const tempBaseDir = join(os.tmpdir(), 'opendxa-trajectories');
    const trajFS = new TrajectoryVFS(trajectoryId, tempBaseDir);
    await trajFS.ensureStructure(trajectoryId);

    const filePromises = filePaths.map(async (filePath) => {
        try {
            const { frameInfo, isValid } = await processTrajectoryFile(filePath);
            if (!frameInfo || !isValid) {
                return null;
            }

            // Read file and save as dump
            const fs = await import('fs/promises');
            const fileBuffer = await fs.readFile(filePath);
            const dumpAbsPath = await trajFS.saveDump(trajectoryId, frameInfo.timestep, fileBuffer, true);

            const stats = await fs.stat(filePath);

            const frameData = {
                ...frameInfo
                // GLBs are now stored in MinIO, not in frame data
            };

            return {
                frameData,
                srcPath: dumpAbsPath,
                originalSize: stats.size,
                originalName: filePath.split('/').pop() || `frame_${frameInfo.timestep}`
            };
        } catch (error: any) {
            logger.error(`Failed to process file ${filePath}: ${error.message}`);
            return null;
        }
    });

    const results = await Promise.all(filePromises);
    return results.filter(Boolean) as ProcessedFile[];
};
