import 'reflect-metadata';
import { registerAllDependencies } from '@core/bootstrap/register-deps';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import {
    getAnalysisRasterFrameObjectName,
    getRasterFrameObjectName
} from '@modules/raster/services/raster-storage-paths';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { RasterUpAxis } from '@shared/infrastructure/utilities/rasterizer';
import {
    createWorkerFailureEnvelope,
    normalizeWorkerFailureEnvelope,
    WorkerFailureError
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import Job from '@modules/jobs/domain/entities/Job';
import logger from '@shared/infrastructure/logger';
import rasterize from '@shared/infrastructure/utilities/rasterizer';
import BaseWorker from '@shared/infrastructure/workers/BaseWorker';
import * as fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { container } from 'tsyringe';
import type { ErrorCode } from '@core/constants/error-codes';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import type { RasterizerOptions } from '@shared/infrastructure/utilities/rasterizer';

interface RasterizerJobOptions extends RasterizerOptions {
    inputPath: string;
    storageKey?: string;
};

export interface RasterizerJobData {
    jobId: string;
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    opts: RasterizerJobOptions;
};

registerAllDependencies();

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

const getStringMetadataField = (metadata: Record<string, unknown> | undefined, key: string): string | undefined => {
    const value = metadata?.[key];

    if (typeof value !== 'string') {
        return undefined;
    }

    return value;
};

const getNumberMetadataField = (metadata: Record<string, unknown> | undefined, key: string): number | undefined => {
    const value = metadata?.[key];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
};

const getUpAxis = (metadata: Record<string, unknown> | undefined): RasterUpAxis | undefined => {
    const up = metadata?.up;

    if (up === RasterUpAxis.Z || up === RasterUpAxis.Y) {
        return up;
    }

    return undefined;
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
        const jobMetadata = asRecord(metadata);
        const trajectoryId = getStringMetadataField(jobMetadata, 'trajectoryId');
        const timestep = getNumberMetadataField(jobMetadata, 'timestep');
        const analysisId = getStringMetadataField(jobMetadata, 'analysisId');
        const model = getStringMetadataField(jobMetadata, 'model');
        const storageKey = getStringMetadataField(jobMetadata, 'storageKey');
        const metaInputPath = getStringMetadataField(jobMetadata, 'inputPath');
        const width = getNumberMetadataField(jobMetadata, 'width');
        const height = getNumberMetadataField(jobMetadata, 'height');
        const fov = getNumberMetadataField(jobMetadata, 'fov');
        const az = getNumberMetadataField(jobMetadata, 'az');
        const el = getNumberMetadataField(jobMetadata, 'el');
        const distScale = getNumberMetadataField(jobMetadata, 'distScale');
        const up = getUpAxis(jobMetadata);

        const start = performance.now();
        logger.info(`[Worker #${process.pid}] Processing Raster Job ${jobId} | Frame ${timestep}`);

        let tempGlbPath: string | null = null;
        const tempPngPath = this.tempFileService.generateFilePath({ prefix: 'raster_', extension: '.png' });

        try {
            if (!trajectoryId || timestep === undefined) {
                throw createRasterWorkerFailure(
                    ErrorCodes.RASTER_WORKER_INPUT_NOT_FOUND,
                    'Raster job metadata is missing trajectoryId or timestep'
                );
            }

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
                up: up ?? RasterUpAxis.Z
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
};

BaseWorker.start(HeadlessRasterizerWorker);
