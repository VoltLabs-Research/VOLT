import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';
import {
    getAnalysisRasterFrameObjectName,
    getAnalysisRasterPreviewsPrefix,
    getRasterFrameObjectName,
    getTrajectoryRasterPreviewsPrefix
} from '@shared/application/utilities/raster-storage-paths';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

const readRasterFrame = async (
    teamClusterId: string,
    objectName: string,
    filename: string
): Promise<RasterFrameResult> => {
    try{
        const response = await objectGatewayClient.getStream(
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
    }catch(error){
        if(error instanceof ApplicationError && error.statusCode === 404){
            throw ApplicationError.notFound(
                ErrorCodes.RASTER_NOT_FOUND,
                'Raster frame not found'
            );
        }

        logger.warn(error, `Failed to stream raster frame from daemon for object ${objectName}`);
        throw error;
    }
};

export const listRasterPreviews = (trajectoryId: string, teamClusterId: string): AsyncIterable<string> =>
    objectGatewayClient.listAll(teamClusterId, {
        bucket: TEAM_CLUSTER_BUCKETS.RASTERIZER,
        prefix: getTrajectoryRasterPreviewsPrefix(trajectoryId)
    });

export const listAnalysisRasterPreviews = (
    trajectoryId: string,
    analysisId: string,
    teamClusterId: string
): AsyncIterable<string> =>
    objectGatewayClient.listAll(teamClusterId, {
        bucket: TEAM_CLUSTER_BUCKETS.RASTERIZER,
        prefix: getAnalysisRasterPreviewsPrefix(trajectoryId, analysisId)
    });

export const readRasterFramePNG = (
    trajectoryId: string,
    timestep: number,
    teamClusterId: string
): Promise<RasterFrameResult> => readRasterFrame(
    teamClusterId,
    getRasterFrameObjectName(trajectoryId, timestep),
    `trajectory-${trajectoryId}-timestep-${timestep}.png`
);

export const readAnalysisRasterFramePNG = (
    trajectoryId: string,
    analysisId: string,
    timestep: number,
    model: string,
    teamClusterId: string
): Promise<RasterFrameResult> => readRasterFrame(
    teamClusterId,
    getAnalysisRasterFrameObjectName(trajectoryId, analysisId, timestep, model),
    `trajectory-${trajectoryId}-analysis-${analysisId}-timestep-${timestep}-${model}.png`
);
