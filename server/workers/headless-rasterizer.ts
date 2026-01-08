
import { BaseWorker } from './base-worker';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { initializeMinio, SYS_BUCKETS } from '@/config/minio';
import storage from '@/services/storage';
import rasterize from '@/utilities/export/rasterizer';
import logger from '@/logger';
import tempFileManager from '@/services/temp-file-manager';
import * as fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const CACHE_CONTROL = 'public, max-age=86400';
const CONTENT_TYPE = 'image/png';

class HeadlessRasterizerWorker extends BaseWorker<RasterizerJob> {
    protected async setup(): Promise<void> {
        await initializeMinio();
        logger.info(`[Worker #${process.pid}] Native Rasterizer Ready`);
    }

    protected async perform(job: RasterizerJob): Promise<void> {
        const start = performance.now();
        const inputPath = job.opts.inputPath as string;
        const tempPng = tempFileManager.generateFilePath({ prefix: 'raster_', extension: '.png' });

        try {
            logger.info(`[Worker #${process.pid}] Processing Job ${job.jobId} (Timestep: ${job.timestep})...`);

            const opts = {
                width: job.opts.width ?? 1600,
                height: job.opts.height ?? 900,
                fov: job.opts.fov ?? 45,
                az: job.opts.az ?? 45,
                el: job.opts.el ?? 25,
                distScale: job.opts.distScale ?? 1.0,
                up: job.opts.up as 'z' | 'y' ?? 'z'
            };

            const inputExists = await fs.access(inputPath).then(() => true).catch(() => false);
            if (!inputExists) throw new Error(`Input file does not exist: ${inputPath}`);

            const success = rasterize(inputPath, tempPng, opts);
            if (!success) throw new Error(`Native rasterization failed`);

            const buffer = await fs.readFile(tempPng);
            if (!buffer || buffer.length === 0) throw new Error('Rasterizer produced empty buffer');

            let objectName: string;
            if (job.analysisId && job.model) {
                objectName = `trajectory-${job.trajectoryId}/analysis-${job.analysisId}/raster/${job.timestep}_${job.model}.png`;
            } else {
                objectName = `trajectory-${job.trajectoryId}/previews/timestep-${job.timestep}.png`;
            }

            await storage.put(SYS_BUCKETS.RASTERIZER, objectName, buffer, {
                'Content-Type': CONTENT_TYPE,
                'Cache-Control': CACHE_CONTROL
            });

            const duration = (performance.now() - start).toFixed(2);
            this.sendMessage({ status: 'completed', jobId: job.jobId, timestep: job.timestep, duration });
            logger.info(`[Worker #${process.pid}] Job ${job.jobId} Success | Duration: ${duration}ms`);

        } catch (error: any) {
            logger.error(`[Worker #${process.pid}] Job ${job.jobId} Failed: ${error.message}`);
            this.sendMessage({
                status: 'failed',
                jobId: job.jobId,
                timestep: job.timestep,
                error: error.message || 'Unknown rasterizer error'
            });
        } finally {
            await fs.unlink(tempPng).catch(() => { });
            if (inputPath) await fs.unlink(inputPath).catch(() => { });
        }
    }
}

BaseWorker.start(HeadlessRasterizerWorker);
