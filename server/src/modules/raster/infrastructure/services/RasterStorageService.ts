import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import {
    getRasterFrameObjectName,
    getTrajectoryModelsPrefix,
    getTrajectoryRasterPreviewsPrefix
} from '@modules/raster/utilities/raster-storage-paths';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export class RasterStorageService implements IRasterStorage {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    listModelFiles(trajectoryId: string): AsyncIterable<string> {
        return this.storageService.listByPrefix(
            SYS_BUCKETS.MODELS,
            getTrajectoryModelsPrefix(trajectoryId)
        );
    }

    listPreviewFiles(trajectoryId: string): AsyncIterable<string> {
        return this.storageService.listByPrefix(
            SYS_BUCKETS.RASTERIZER,
            getTrajectoryRasterPreviewsPrefix(trajectoryId)
        );
    }

    async getRasterFramePNG(trajectoryId: string, timestep: number): Promise<RasterFrameResult> {
        const objectName = getRasterFrameObjectName(trajectoryId, timestep);

        try {
            const exists = await this.storageService.exists(SYS_BUCKETS.RASTERIZER, objectName);

            if (!exists) {
                throw ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'Raster frame not found'
                );
            }

            const [stream, stat] = await Promise.all([
                this.storageService.getStream(SYS_BUCKETS.RASTERIZER, objectName),
                this.storageService.getStat(SYS_BUCKETS.RASTERIZER, objectName)
            ]);

            return {
                stream,
                contentLength: stat.size,
                contentType: stat.mimetype || 'image/png',
                cacheControl: 'public, max-age=86400',
                filename: `trajectory-${trajectoryId}-timestep-${timestep}.png`
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            logger.warn(error, `Failed to retrieve raster frame PNG for trajectory ${trajectoryId}, timestep ${timestep}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            );
        }
    }
};
