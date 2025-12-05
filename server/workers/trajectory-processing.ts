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

import { parentPort } from 'node:worker_threads';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { performance } from 'node:perf_hooks';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/logger';
import AtomisticExporter from '@/utilities/export/atoms';
import DumpStorage from '@/services/dump-storage';
import * as path from 'node:path';
import * as os from 'node:os';
import '@config/env';

const exporter = new AtomisticExporter();

/**
 * Downloads the raw LAMMPS dump stream from the storage service to a transient local file.
 * Uses Node.js streaming pipeline for optimal RAM usage.
 * 
 * @param trajectoryId - The ID of the trajectory.
 * @param timestep - The specific timestep to fetch.
 * @param destinationPath - The ephemeral path where the file will be written.
 */
const downloadFromStorage = async (
    trajectoryId: string,
    timestep: number,
    destinationPath: string
): Promise<void> => {
    // Fetches the read stream from MinIO via the centralized service
    const readStream = await DumpStorage.getDumpStream(trajectoryId, timestep);
    const writeStream = createWriteStream(destinationPath);

    // Pipes the download directly to disk, avoiding memory buffering
    await pipeline(readStream, writeStream);
};

/**
 * Processes a single frame following the Cloud Native Protocol.
 * 
 * @param frameInfo - Metadata containing the timestep.
 * @param frameUri - The source URI (minio://...).
 * @param trajectoryId - The ID of the trajectory.
 */
const processCloudFrame = async (
    frameInfo: { timestep: number },
    frameUri: string,
    trajectoryId: string
): Promise<void> => {
    const start = performance.now();

    if(!frameUri.startsWith('minio://')){
        throw new Error(`Invalid Protocol: Worker expects 'minio://' URI, received '${frameUri}'.`);
    }

    // Unique temp file for this specific process/thread
    const tempFileName = `cloud_proc_${trajectoryId}_${frameInfo.timestep}_${uuidv4()}.dump`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try{
        // Download. We ignore the path in the URI and use the ID/Timestep to query the Storage Service safely.
        await downloadFromStorage(trajectoryId, frameInfo.timestep, tempFilePath);

        // Convert & Upload. The exporter reads the temp file, generates GLB, and pushes it to the 'previews' bucket path.
        const targetObjectName = `trajectory-${trajectoryId}/previews/timestep-${frameInfo.timestep}.glb`;

        await exporter.toGLBMinIO(
            tempFilePath,
            targetObjectName
        );

        const duration = (performance.now() - start).toFixed(2);
        logger.debug(`[Worker ${process.pid}] Frame ${frameInfo.timestep} processed in ${duration}ms`);
    }catch(err){
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Worker ${process.pid}] Frame ${frameInfo.timestep} Failed: ${msg}`);
        // Propagate error to fail the Promise
        throw err;
    }finally{
        // Guaranteed Cleanup. We intentionally suppress unlink errors to avoid crashing 
        // the worker flow on cleanup issues.
        await unlink(tempFilePath).catch(() => {});
    }
};

/**
 * Process the entire chunk of files in parallel.
 */
const processJob = async (job: TrajectoryProcessingJob) => {
    if(!job?.jobId){
        throw new Error('MissingJobId');
    }

    const { files, trajectoryId } = job;
    const start = performance.now();

    logger.info(
        `[Worker #${process.pid}] Start Job ${job.jobId} | ` +
        `Files: ${files.length} | Chunk: ${job.chunkIndex + 1}/${job.totalChunks}`
    );

    try{
        // Fire all frame processors simultaneously.
        // If any frame fails, Promise.all rejects immediately marking the chunk as failed.
        await Promise.all(
            files.map(file => processCloudFrame(file.frameInfo, file.frameFilePath, trajectoryId)));
        const totalTime = (performance.now() - start).toFixed(2);
        logger.info(`[Worker #${process.pid}] Job ${job.jobId} Success | Duration: ${totalTime}ms`);
        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            totalChunks: job.totalChunks,
            duration: totalTime
        });
    }catch(error){
        logger.error(`[Worker #${process.pid}] Job ${job.jobId} Failed: ${error}`);

        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

/**
 * Worker Entry Point
 */
const main = () => {
    logger.info(`[Worker #${process.pid}] Online - Strict Cloud Native Mode`);

    parentPort?.on('message', async (message: { job: TrajectoryProcessingJob }) => {
        try{
            if(message.job) await processJob(message.job);
        }catch(error){
            logger.error(`[Worker #${process.pid}] Fatal Exception: ${error}`);
            parentPort?.postMessage({
                status: 'failed',
                jobId: message.job?.jobId || 'unknown',
                error: 'Fatal worker exception'
            });
        }
    });
};

main();