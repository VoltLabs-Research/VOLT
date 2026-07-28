import { ErrorCodes } from '@core/constants/error-codes';
import type {
    RasterAnalysisMetadata,
    RasterFrameMetadata, RasterMetadata, RasterTrajectoryMetadata
} from '@shared/contracts/types/RasterMetadata';
import { RasterMetadataStatus } from '@shared/contracts/types/RasterMetadata';
import { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import { parseAnalysisRasterFrameKey, parseRasterTimestep } from '@shared/application/utilities/raster-storage-paths';
import { resolveAnalysisStorageClusterId } from '@shared/application/utilities/cluster-location';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';

interface RasterFramesByTimestep{
    [timestep: number]: Set<string>;
}

interface ResolvedTrajectoryRasterMetadata{
    rasterizedFrames: number;
    trajectory: RasterTrajectoryMetadata | null;
}

export class RasterMetadataService{
    constructor(
        private readonly rasterStorage: RasterStorageService
    ){}

    async getRasterMetadata(trajectoryId: string, teamId: string): Promise<RasterMetadata | null>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if(!trajectory || trajectory.team !== teamId){
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const totalFrames = await TrajectoryFrame.countBy({ trajectoryId });
        const storageClusterId = trajectory.storageClusterId;
        if(!storageClusterId){
            throw ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            );
        }
        const trajectoryRaster = await this.getTrajectoryMetadata(trajectoryId, storageClusterId);

        const analyses = await this.getAnalysesMetadata(trajectoryId, totalFrames);
        const rasterizedFrames = trajectoryRaster.rasterizedFrames;

        if(!trajectoryRaster.trajectory && analyses.length === 0){
            return null;
        }

        let status = RasterMetadataStatus.Processing;
        if(rasterizedFrames >= totalFrames && totalFrames > 0){
            status = RasterMetadataStatus.Completed;
        }

        if(!totalFrames && (trajectoryRaster.trajectory || analyses.length > 0)){
            status = RasterMetadataStatus.Completed;
        }

        return {
            trajectoryId,
            totalFrames,
            rasterizedFrames,
            status,
            trajectory: trajectoryRaster.trajectory,
            analyses,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    private async getTrajectoryMetadata(
        trajectoryId: string,
        teamClusterId: string
    ): Promise<ResolvedTrajectoryRasterMetadata>{
        const availableTimesteps = new Set<number>();

        try{
            for await (const fileKey of this.rasterStorage.listPreviewFiles(trajectoryId, teamClusterId)){
                const timestep = parseRasterTimestep(fileKey);
                if(timestep === null){
                    continue;
                }

                availableTimesteps.add(timestep);
            }
        }catch(error){
            logger.warn(error, `Failed to list raster previews for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list raster previews',
                500
            );
        }

        const orderedTimesteps = Array.from(availableTimesteps).sort((leftTimestep, rightTimestep) => leftTimestep - rightTimestep);
        if(!orderedTimesteps.length){
            return {
                rasterizedFrames: 0,
                trajectory: null
            };
        }

        return {
            rasterizedFrames: orderedTimesteps.length,
            trajectory: {
                availableTimesteps: orderedTimesteps
            }
        };
    }

    private async getAnalysesMetadata(
        trajectoryId: string,
        totalFrames: number
    ): Promise<RasterAnalysisMetadata[]>{
        try{
            const analyses = await Analysis.findBy({ trajectory: trajectoryId });

            const analysesMetadata = await Promise.all(analyses.map(async (analysis) => {
                return this.getAnalysisMetadata(
                    trajectoryId,
                    analysis.id,
                    totalFrames,
                    resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId ?? undefined })
                );
            }));

            return analysesMetadata.filter((analysis): analysis is RasterAnalysisMetadata => Boolean(analysis));
        }catch(error){
            logger.warn(error, `Failed to resolve raster analyses metadata for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to resolve raster analyses metadata',
                500
            );
        }
    }

    private async getAnalysisMetadata(
        trajectoryId: string,
        analysisId: string,
        totalFrames: number,
        teamClusterId: string | undefined
    ): Promise<RasterAnalysisMetadata | null>{
        if(!teamClusterId){
            throw ApplicationError.conflict(
                'Analysis::StorageClusterRequired',
                'Analysis storage cluster is required'
            );
        }

        const framesByTimestep: RasterFramesByTimestep = {};

        try{
            for await (const fileKey of this.rasterStorage.listAnalysisPreviewFiles(trajectoryId, analysisId, teamClusterId)){
                const parsedFrame = parseAnalysisRasterFrameKey(fileKey);
                if(!parsedFrame){
                    continue;
                }

                const existingModels = framesByTimestep[parsedFrame.timestep] ?? new Set<string>();
                existingModels.add(parsedFrame.model);
                framesByTimestep[parsedFrame.timestep] = existingModels;
            }
        }catch(error){
            logger.warn(error, `Failed to list raster analysis previews for trajectory ${trajectoryId}, analysis ${analysisId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list raster analysis previews',
                500
            );
        }

        const frames = Object.keys(framesByTimestep)
            .map((timestep): RasterFrameMetadata => {
                const models = framesByTimestep[Number.parseInt(timestep, 10)] ?? new Set<string>();

                return {
                    timestep: Number.parseInt(timestep, 10),
                    availableModels: Array.from(models).sort((leftModel, rightModel) => leftModel.localeCompare(rightModel))
                };
            })
            .sort((leftFrame, rightFrame) => leftFrame.timestep - rightFrame.timestep);

        if(!frames.length){
            return null;
        }

        return {
            analysisId,
            totalFrames,
            rasterizedFrames: frames.length,
            availableTimesteps: frames.map((frame) => frame.timestep),
            frames
        };
    }
}
