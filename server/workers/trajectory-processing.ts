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

import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import logger from '@/logger';
import AtomisticExporter from '@/utilities/export/atoms';
import DumpStorage from '@/services/dump-storage';
import '@config/env';

const exporter = new AtomisticExporter();

const processFrame = async (
    frameInfo: { timestep: number },
    frameUri: string,
    trajectoryId: string
): Promise<void> =>{
    try{
        const localDumpPath = await DumpStorage.getDump(trajectoryId, frameInfo.timestep);
        if(!localDumpPath) throw new Error('Dump not found');

        const targetObjectName = `trajectory-${trajectoryId}/previews/timestep-${frameInfo.timestep}.glb`;
        await exporter.toGLBMinIO(localDumpPath, targetObjectName);
    }catch(err){
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`[Worker ${process.pid}] Frame ${frameInfo.timestep} Failed: ${msg}`);
        throw err
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
            files.map(file => processFrame(file.frameInfo, file.frameFilePath, trajectoryId)));
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

    parentPort?.on('message', async(message: { job: TrajectoryProcessingJob }) => {
        try{
            await processJob(message.job);
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
