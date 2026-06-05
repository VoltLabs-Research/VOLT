import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';
import type { IRasterStorageService } from '@modules/raster/domain/port/IRasterStorageService';
import {
    getAnalysisRasterFrameObjectName,
    getAnalysisRasterPreviewsPrefix,
    getRasterFrameObjectName,
    getTrajectoryRasterPreviewsPrefix
} from '@modules/raster/utilities/raster-storage-paths';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

@Singleton(RASTER_TOKENS.RasterStorageService)
export class RasterStorageService implements IRasterStorageService {
    constructor(
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async hasTrajectoryPreview(trajectoryId: string, teamClusterId: string): Promise<boolean> {
        const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);

        for await (const key of this.listObjectKeys(TEAM_CLUSTER_BUCKETS.RASTERIZER, prefix, teamClusterId)) {
            if (key.endsWith('.png')) {
                return true;
            }
        }

        return false;
    }

    async *listPreviewFiles(trajectoryId: string, teamClusterId: string): AsyncIterable<string> {
        const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);
        yield* this.listObjectKeys(TEAM_CLUSTER_BUCKETS.RASTERIZER, prefix, teamClusterId);
    }

    async *listAnalysisPreviewFiles(
        trajectoryId: string,
        analysisId: string,
        teamClusterId: string
    ): AsyncIterable<string> {
        const prefix = getAnalysisRasterPreviewsPrefix(trajectoryId, analysisId);
        yield* this.listObjectKeys(TEAM_CLUSTER_BUCKETS.RASTERIZER, prefix, teamClusterId);
    }

    async getRasterFramePNG(trajectoryId: string, timestep: number, teamClusterId: string): Promise<RasterFrameResult> {
        const objectName = getRasterFrameObjectName(trajectoryId, timestep);

        try {
            return await this.getRemoteRasterFramePNG(teamClusterId, objectName, `trajectory-${trajectoryId}-timestep-${timestep}.png`);
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
        teamClusterId: string
    ): Promise<RasterFrameResult> {
        const objectName = getAnalysisRasterFrameObjectName(trajectoryId, analysisId, timestep, model);

        try {
            return await this.getRemoteRasterFramePNG(
                teamClusterId,
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
        teamClusterId: string
    ): AsyncIterable<string> {
        yield* this.objectGatewayClient.listAll(teamClusterId, { bucket, prefix });
    }

    private async getRemoteRasterFramePNG(
        teamClusterId: string,
        objectName: string,
        filename: string
    ): Promise<RasterFrameResult> {
        try {
            const response = await this.objectGatewayClient.getStream(
                teamClusterId,
                TEAM_CLUSTER_BUCKETS.RASTERIZER,
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
}
