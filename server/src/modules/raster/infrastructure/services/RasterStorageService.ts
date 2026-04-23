import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type { RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';
import {
    getAnalysisRasterFrameObjectName,
    getAnalysisRasterPreviewsPrefix,
    getRasterFrameObjectName,
    getTrajectoryRasterPreviewsPrefix
} from '@modules/raster/utilities/raster-storage-paths';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Singleton()
export class RasterStorageService {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async hasTrajectoryPreview(trajectoryId: string, teamClusterId?: string): Promise<boolean> {
        const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);

        for await (const key of this.listObjectKeys(SYS_BUCKETS.RASTERIZER, prefix, teamClusterId)) {
            if (key.endsWith('.png')) {
                return true;
            }
        }

        return false;
    }

    async *listPreviewFiles(trajectoryId: string, teamClusterId?: string): AsyncIterable<string> {
        const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);
        yield* this.listObjectKeys(SYS_BUCKETS.RASTERIZER, prefix, teamClusterId);
    }

    async *listAnalysisPreviewFiles(
        trajectoryId: string,
        analysisId: string,
        teamClusterId?: string
    ): AsyncIterable<string> {
        const prefix = getAnalysisRasterPreviewsPrefix(trajectoryId, analysisId);
        yield* this.listObjectKeys(SYS_BUCKETS.RASTERIZER, prefix, teamClusterId);
    }

    async getRasterFramePNG(trajectoryId: string, timestep: number, teamClusterId?: string): Promise<RasterFrameResult> {
        const objectName = getRasterFrameObjectName(trajectoryId, timestep);

        try {
            if (teamClusterId) {
                return await this.getRemoteRasterFramePNG(teamClusterId, objectName, `trajectory-${trajectoryId}-timestep-${timestep}.png`);
            }

            return this.getLocalRasterFramePNG(objectName, `trajectory-${trajectoryId}-timestep-${timestep}.png`);
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

    async getAnalysisRasterFramePNG(
        trajectoryId: string,
        analysisId: string,
        timestep: number,
        model: string,
        teamClusterId?: string
    ): Promise<RasterFrameResult> {
        const objectName = getAnalysisRasterFrameObjectName(trajectoryId, analysisId, timestep, model);

        try {
            if (teamClusterId) {
                return await this.getRemoteRasterFramePNG(
                    teamClusterId,
                    objectName,
                    `trajectory-${trajectoryId}-analysis-${analysisId}-timestep-${timestep}-${model}.png`
                );
            }

            return this.getLocalRasterFramePNG(
                objectName,
                `trajectory-${trajectoryId}-analysis-${analysisId}-timestep-${timestep}-${model}.png`
            );
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            logger.warn(error, `Failed to retrieve analysis raster frame PNG for trajectory ${trajectoryId}, analysis ${analysisId}, timestep ${timestep}, model ${model}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to retrieve raster frame PNG',
                500
            );
        }
    }

    private async *listObjectKeys(
        bucket: string,
        prefix: string,
        teamClusterId?: string
    ): AsyncIterable<string> {
        if (teamClusterId) {
            yield* this.objectGatewayClient.listAll(teamClusterId, { bucket, prefix });
            return;
        }

        for await (const key of this.storageService.listByPrefix(bucket, prefix)) {
            yield key;
        }
    }

    private async getLocalRasterFramePNG(objectName: string, filename: string): Promise<RasterFrameResult> {
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
            filename
        };
    }

    private async getRemoteRasterFramePNG(
        teamClusterId: string,
        objectName: string,
        filename: string
    ): Promise<RasterFrameResult> {
        try {
            const response = await this.objectGatewayClient.getStream(
                teamClusterId,
                SYS_BUCKETS.RASTERIZER,
                objectName
            );

            return {
                stream: response.stream,
                contentLength: response.contentLength,
                contentType: response.contentType || 'image/png',
                cacheControl: 'public, max-age=86400',
                filename
            };
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.RASTER_NOT_FOUND,
                    'Raster frame not found'
                );
            }

            logger.warn(error, `Failed to stream raster frame from daemon for object ${objectName}`);
            throw error;
        }
    }
};
