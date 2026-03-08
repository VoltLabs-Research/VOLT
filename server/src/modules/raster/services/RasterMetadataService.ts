import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { RasterMetadataStatus } from '@modules/raster/domain/entities/RasterMetadata';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IRasterMetadataReader } from '@modules/raster/domain/port/IRasterMetadataReader';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { RasterMetadata } from '@modules/raster/domain/entities/RasterMetadata';

@injectable()
export class RasterMetadataService implements IRasterMetadataReader {
    constructor(
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage
    ) {}

    async getRasterMetadata(trajectoryId: string): Promise<RasterMetadata | null> {
        let rasterizedFrames = 0;

        try {
            for await (const file of this.rasterStorage.listPreviewFiles(trajectoryId)) {
                if (file.endsWith('.png')) {
                    rasterizedFrames++;
                }
            }
        } catch (error) {
            logger.warn(error, `Failed to list raster previews for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list raster previews',
                500
            );
        }

        if (rasterizedFrames === 0) {
            return null;
        }

        let totalFrames = 0;

        try {
            for await (const file of this.rasterStorage.listModelFiles(trajectoryId)) {
                if (file.endsWith('.glb')) {
                    totalFrames++;
                }
            }
        } catch (error) {
            logger.warn(error, `Failed to list GLB models for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list GLB models for raster metadata',
                500
            );
        }

        let status = RasterMetadataStatus.Processing;
        if (rasterizedFrames >= totalFrames && totalFrames > 0) {
            status = RasterMetadataStatus.Completed;
        }

        return {
            trajectoryId,
            totalFrames,
            rasterizedFrames,
            status,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
};
