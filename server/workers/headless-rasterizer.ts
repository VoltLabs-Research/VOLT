import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { initializeMinio, SYS_BUCKETS } from '@/config/minio';
import storage from '@/services/storage';
import rasterize from '@/utilities/export/rasterizer';
import logger from '@/logger';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import tempFileManager from '@/services/temp-file-manager';

const CACHE_CONTROL = 'public, max-age=86400';
const CONTENT_TYPE = 'image/png';

const processJob = async (job: RasterizerJob): Promise<void> => {
    const start = performance.now();
    const inputPath = job.opts.inputPath as string;
    const tempPng = tempFileManager.generateFilePath({ prefix: 'raster_', extension: '.png' });


    try {
        logger.info(`[Worker #${process.pid}] Processing Job ${job.jobId} (Timestep: ${job.timestep})...`);

        const success = rasterize(inputPath, tempPng, {
            width: job.opts.width ?? 1600,
            height: job.opts.height ?? 900,
            fov: job.opts.fov ?? 45,
            az: job.opts.az ?? 45,
            el: job.opts.el ?? 25,
            distScale: job.opts.distScale ?? 1.0,
            up: job.opts.up as 'z' | 'y' ?? 'z'
        });

        if (!success) {
            throw new Error('Native rasterization failed');
        }

        const buffer = await fs.readFile(tempPng);
        if (!buffer || buffer.length === 0) {
            throw new Error('Rasterizer produced empty buffer');
        }

        const objectName = `trajectory-${job.trajectoryId}/previews/timestep-${job.timestep}.png`;
        await storage.put(SYS_BUCKETS.RASTERIZER, objectName, buffer, {
            'Content-Type': CONTENT_TYPE,
            'Cache-Control': CACHE_CONTROL
        });

        const duration = (performance.now() - start).toFixed(2);
        parentPort?.postMessage({ status: 'completed', jobId: job.jobId, timestep: job.timestep, duration });
        logger.info(`[Worker #${process.pid}] Job ${job.jobId} Success | Duration: ${duration}ms`);
    } catch (error: any) {
        logger.error(`[Worker #${process.pid}] Job ${job.jobId} Failed: ${error.message}`);
        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            timestep: job.timestep,
            error: error.message || 'Unknown rasterizer error'
        });
    } finally {
        await fs.unlink(tempPng).catch(() => { });
        if (inputPath) {
            await fs.unlink(inputPath).catch(() => { });
        }
    }
};

const main = async () => {
    try {
        await initializeMinio();
        logger.info(`[Worker #${process.pid}] Online - Native Rasterizer Ready`);

        parentPort?.on('message', async (message: { job: RasterizerJob }) => {
            if (!message?.job) {
                logger.error(`[Worker #${process.pid}] Received invalid message payload`);
                return;
            }

            try {
                await processJob(message.job);
            } catch (fatalError) {
                logger.error(`[Worker #${process.pid}] Fatal Unhandled Error: ${fatalError}`);
                parentPort?.postMessage({
                    status: 'failed',
                    jobId: message.job.jobId,
                    error: 'Fatal worker crash'
                });
            }
        });
    } catch (initError) {
        logger.error(`[Worker #${process.pid}] Failed to initialize worker: ${initError}`);
        process.exit(1);
    }
};

main();
