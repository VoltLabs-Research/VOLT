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

import { extractTimestepInfo } from '@/utilities/lammps';
import { parentPort } from 'worker_threads';
import { unlink } from 'fs/promises';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import AtomisticExporter from '@/utilities/export/atoms';
import DumpStorage from '@/services/dump-storage';
import '@config/env';
import logger from '@/logger';

const glbExporter = new AtomisticExporter();

const processSingleFrame = async (frameData: any, frameFilePath: string, trajectoryId: string) => {
    // Generate GLB from the local dump file
    const objectName = `trajectory-${trajectoryId}/previews/timestep-${frameData.timestep}.glb`;
    await glbExporter.toGLBMinIO(
        frameFilePath,
        objectName,
        extractTimestepInfo
    );

    // After GLB is created, migrate the dump to MinIO and clean up filesystem
    try {
        const timestep = frameData.timestep;
        const buffer = await import('fs/promises').then(fs => fs.readFile(frameFilePath));
        await DumpStorage.saveDump(trajectoryId, timestep, buffer);

        // Delete the local file
        await unlink(frameFilePath);
        logger.info(`[Worker #${process.pid}] Migrated dump ${timestep} to MinIO and cleaned up filesystem`);
    } catch (err) {
        logger.error(`[Worker #${process.pid}] Failed to migrate dump to MinIO: ${err}`);
        // Don't fail the job if migration fails, just log it
    }
};

const processJob = async (job: TrajectoryProcessingJob) => {
    if (!job || !job.jobId) {
        throw new Error('Invalid job payload');
    }

    const { files, trajectoryId } = job;

    logger.info(
        `[Worker #${process.pid}] Start job ${job.jobId} ` +
        `(chunk ${job.chunkIndex + 1}/${job.totalChunks})`
    );

    try {
        await Promise.all(files.map(({ frameData, frameFilePath }) => processSingleFrame(frameData, frameFilePath, trajectoryId)));
        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            totalChunks: job.totalChunks
        });

        logger.info(`[Worker #${process.pid}] Job ${job.jobId} completed OK.`);
    } catch (error) {
        logger.error(
            `[Worker #${process.pid}] Job ${job.jobId} failed: ${error}`
        );

        // Clean up leftover files (paralelo y sin bloquear)
        await Promise.all(
            files.map(({ frameFilePath }) =>
                unlink(frameFilePath).catch(() => { })
            )
        );

        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const main = () => {
    logger.info(`[Worker #${process.pid}] Worker started`);

    parentPort?.on('message', async ({ job }) => {
        try {
            await processJob(job);
        } catch (error) {
            logger.error(`[Worker #${process.pid}] Fatal worker error: ${error}`);

            parentPort?.postMessage({
                status: 'failed',
                jobId: job?.jobId || 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
};

main();