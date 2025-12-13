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
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { initializeMinio, SYS_BUCKETS } from '@/config/minio';
import storage from '@/services/storage';
import HeadlessRasterizer from '@/services/headless-rasterizer';
import logger from '@/logger';
import * as fs from 'node:fs/promises';

const CACHE_CONTROL = 'public, max-age=86400';
const CONTENT_TYPE = 'image/png';

/**
 * Process a single rasterization job.
 *
 * @param job - The payload containing input paths and render options.
 */
const processJob = async(job: RasterizerJob): Promise<void> =>{
    const start = performance.now();
    const inputPath = job.opts.inputPath as string;

    try{
        logger.info(`[Worker #${process.pid}] Processing Job ${job.jobId} (Timestep: ${job.timestep})...`);

        // @ts-ignore
        const raster = new HeadlessRasterizer(job.opts);
        const buffer = await raster.render();

        if(!buffer || buffer.length === 0){
            throw new Error('HeadlessRasterizerEmptyBuffer');
        }

        const objectName = `trajectory-${job.trajectoryId}/previews/timestep-${job.timestep}.png`;
        await storage.put(SYS_BUCKETS.RASTERIZER, objectName, buffer, {
            'Content-Type': CONTENT_TYPE,
            'Cache-Control': CACHE_CONTROL
        });

        const duration = (performance.now() - start).toFixed(2);
        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            duration
        });

        logger.info(`[Worker #${process.pid}] Job ${job.jobId} Success | Duration: ${duration}ms`);
    }catch(error: any){
        logger.error(`[Worker #${process.pid}] Job ${job.jobId} Failed: ${error.message}`);

        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            error: error.message || 'Unknown rasterizer error'
        });
    }finally{
        if(inputPath){
            await fs.unlink(inputPath).catch((err) => {
                logger.warn(`[Worker #${process.pid}] Failed to clean up temp file ${inputPath}: ${err.message}`);
            });
        }
    }
};

/**
 * Worker Entry Point.
 */
const main = async() => {
    try{
        await initializeMinio();
        logger.info(`[Worker #${process.pid}] Online - Headless Rasterizer Ready`);

        parentPort?.on('message', async(message: { job: RasterizerJob }) => {
            if(!message || !message.job){
                logger.error(`[Worker #${process.pid}] Received invalid message payload`);
                return;
            }

            try{
                await processJob(message.job);
            }catch(fatalError){
                logger.error(`[Worker #${process.pid}] Fatal Unhandled Error: ${fatalError}`);
                parentPort?.postMessage({
                    status: 'failed',
                    jobId: message.job.jobId,
                    error: 'Fatal worker crash'
                });
            }
        });
    }catch(initError){
        logger.error(`[Worker #${process.pid}] Failed to initialize worker: ${initError}`);
        process.exit(1);
    }
};

main();
