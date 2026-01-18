import "reflect-metadata";
import '@/src/core/bootstrap/register-deps';
import BaseWorker from '@/src/shared/infrastructure/workers/BaseWorker';
import logger from '@/src/shared/infrastructure/logger';
import { container } from 'tsyringe';
import { performance } from 'node:perf_hooks';
import Job from '@/src/modules/jobs/domain/entities/Job';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@/src/shared/domain/ports/IStorageService';
import { ITempFileService } from '@/src/shared/domain/ports/ITempFileService';
import rasterize from '@/src/shared/infrastructure/utils/rasterizer';
import * as fs from 'node:fs/promises';
import { SYS_BUCKETS } from '@/src/core/config/minio';

export interface RasterizerJobData {
    jobId: string;
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    opts: {
        inputPath: string;
        storageKey?: string;
        width?: number;
        height?: number;
        fov?: number;
        az?: number;
        el?: number;
        distScale?: number;
        up?: 'z' | 'y';
    };
}

export default class HeadlessRasterizerWorker extends BaseWorker<Job> {
    private storageService!: IStorageService;
    private tempFileService!: ITempFileService;

    protected async setup(): Promise<void> {
        await this.connectDB();
        this.storageService = container.resolve(SHARED_TOKENS.StorageService);
        this.tempFileService = container.resolve(SHARED_TOKENS.TempFileService);
        logger.info(`[Worker #${process.pid}] Headless Rasterizer Worker Ready`);
    }

    protected async perform(job: Job): Promise<void> {
        const { jobId, metadata } = job.props;
        const { trajectoryId, timestep, analysisId, model, storageKey, inputPath: metaInputPath, width, height, fov, az, el, distScale, up } = metadata || {};

        const start = performance.now();
        logger.info(`[Worker #${process.pid}] Processing Raster Job ${jobId} | Frame ${timestep}`);

        let tempGlbPath: string | null = null;
        const tempPngPath = this.tempFileService.generateFilePath({ prefix: 'raster_', extension: '.png' });

        try {
            // If inputPath is provided in metadata, use it (from legacy compat)
            // But preferably we download from storageKey if provided
            let inputPath = metaInputPath;

            if (storageKey) {
                // Download from storage
                tempGlbPath = this.tempFileService.generateFilePath({ prefix: `glb_${timestep}_`, extension: '.glb' });
                // Assuming SYS_BUCKETS.MODELS or we check where GLBs are. 
                // Legacy used rasterizeGLBs utility passing buckets.
                // We'll assume the key is full or relative to a bucket.
                // RasterService will likely pass the bucket + key or just key.
                await this.storageService.download(SYS_BUCKETS.MODELS, storageKey, tempGlbPath);
                inputPath = tempGlbPath;
            }

            const inputExists = await fs.access(inputPath).then(() => true).catch(() => false);
            if (!inputExists) throw new Error(`Input file does not exist: ${inputPath}`);

            const success = rasterize(inputPath, tempPngPath, {
                width,
                height,
                fov,
                az,
                el,
                distScale,
                up
            });

            if (!success) throw new Error(`Native rasterization failed`);

            const buffer = await fs.readFile(tempPngPath);
            if (!buffer || buffer.length === 0) throw new Error('Rasterizer produced empty buffer');

            let objectName: string;
            if (analysisId && model) {
                objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/raster/${timestep}_${model}.png`;
            } else {
                objectName = `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;
            }

            // Save to RASTERIZER bucket
            await this.storageService.upload(SYS_BUCKETS.RASTERIZER, objectName, buffer, {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400'
            });

            const duration = (performance.now() - start).toFixed(2);
            logger.info(`[Worker #${process.pid}] Job ${jobId} Success | Duration: ${duration}ms`);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                duration
            });

        } catch (error: any) {
            logger.error(`[Worker #${process.pid}] Job ${jobId} Failed: ${error.message}`);
            this.sendMessage({
                status: 'failed',
                jobId,
                timestep,
                error: error.message
            });
        } finally {
            await fs.unlink(tempPngPath).catch(() => { });
            if (tempGlbPath) await fs.unlink(tempGlbPath).catch(() => { });
        }
    }
}

BaseWorker.start(HeadlessRasterizerWorker);
