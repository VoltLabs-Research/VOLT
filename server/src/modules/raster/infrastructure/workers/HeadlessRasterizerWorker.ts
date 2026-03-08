import "reflect-metadata";
import { registerAllDependencies } from '@core/bootstrap/register-deps';
import BaseWorker from '@shared/infrastructure/workers/BaseWorker';
import logger from '@shared/infrastructure/logger';
import { container } from 'tsyringe';
import { performance } from 'node:perf_hooks';
import Job from '@modules/jobs/domain/entities/Job';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { ITempFileService } from '@shared/domain/port/ITempFileService';
import rasterize from '@shared/infrastructure/utilities/rasterizer';
import * as fs from 'node:fs/promises';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes, type ErrorCode } from '@core/constants/error-codes';
import {
    createWorkerFailureEnvelope,
    normalizeWorkerFailureEnvelope,
    WorkerFailureError
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import {
    getAnalysisRasterFrameObjectName,
    getRasterFrameObjectName
} from '@modules/raster/infrastructure/services/raster-storage-paths';

registerAllDependencies();

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

const resolveErrorDetails = (error: unknown, fallbackDetails: string): string => {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
        return error;
    }

    return fallbackDetails;
};

const createRasterWorkerFailure = (code: ErrorCode, details: string): WorkerFailureError => {
    return new WorkerFailureError(createWorkerFailureEnvelope({
        code,
        details
    }));
};

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
            let inputPath = metaInputPath;

            if (storageKey) {
                tempGlbPath = this.tempFileService.generateFilePath({ prefix: `glb_${timestep}_`, extension: '.glb' });

                try {
                    await this.storageService.download(SYS_BUCKETS.MODELS, storageKey, tempGlbPath);
                } catch (error: unknown) {
                    throw createRasterWorkerFailure(
                        ErrorCodes.RASTER_WORKER_DOWNLOAD_FAILED,
                        resolveErrorDetails(error, `Failed to download model from storage: ${storageKey}`)
                    );
                }

                inputPath = tempGlbPath;
            }

            if (!inputPath) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_INPUT_NOT_FOUND,
                    'Raster input path is missing'
                );
            }

            const inputExists = await fs.access(inputPath).then(() => true).catch(() => false);
            if (!inputExists) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_INPUT_NOT_FOUND,
                    `Input file does not exist: ${inputPath}`
                );
            }

            const success = rasterize(inputPath, tempPngPath, {
                width,
                height,
                fov,
                az,
                el,
                distScale,
                up: up ?? 'z'
            });

            if (!success) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_RENDER_FAILED,
                    'Native rasterization failed'
                );
            }

            let buffer: Buffer;

            try {
                buffer = await fs.readFile(tempPngPath);
            } catch (error: unknown) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_OUTPUT_INVALID,
                    resolveErrorDetails(error, `Failed to read rasterized output: ${tempPngPath}`)
                );
            }

            if (buffer.length === 0) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_OUTPUT_INVALID,
                    'Rasterizer produced empty buffer'
                );
            }

            let objectName: string;
            if (analysisId && model) {
                objectName = getAnalysisRasterFrameObjectName(trajectoryId, analysisId, timestep, model);
            } else {
                objectName = getRasterFrameObjectName(trajectoryId, timestep);
            }

            try {
                await this.storageService.upload(SYS_BUCKETS.RASTERIZER, objectName, buffer, {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=86400'
                });
            } catch (error: unknown) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_UPLOAD_FAILED,
                    resolveErrorDetails(error, `Failed to upload raster output: ${objectName}`)
                );
            }

            const duration = (performance.now() - start).toFixed(2);
            logger.info(`[Worker #${process.pid}] Job ${jobId} Success | Duration: ${duration}ms`);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                duration
            });

        } catch (error: unknown) {
            const failure = normalizeWorkerFailureEnvelope({
                error,
                fallbackCode: ErrorCodes.WORKER_FAILURE,
                fallbackDetails: `Raster job ${jobId} failed`
            });

            logger.error({
                jobId,
                timestep,
                failure
            }, `[Worker #${process.pid}] Job ${jobId} Failed: ${failure.code}`);

            this.sendFailure(jobId, failure, {
                timestep
            });
        } finally {
            await fs.unlink(tempPngPath).catch(() => { });
            if (tempGlbPath) await fs.unlink(tempGlbPath).catch(() => { });
        }
    }
}

BaseWorker.start(HeadlessRasterizerWorker);
