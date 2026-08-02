import { ErrorCodes } from '@core/constants/error-codes';
import type {
    RasterAnalysisMetadata,
    RasterMetadata, RasterTrajectoryMetadata
} from '@shared/contracts/types/RasterMetadata';
import { RasterMetadataStatus } from '@shared/contracts/types/RasterMetadata';
import { requireTrajectoryStorageCluster } from '@modules/raster/services/raster-frames';
import { listAnalysisRasterPreviews, listRasterPreviews } from '@modules/raster/services/raster-storage';
import { parseAnalysisRasterFrameKey, parseRasterTimestep } from '@shared/application/utilities/raster-storage-paths';
import ApplicationError from '@shared/application/errors/ApplicationError';

import Analysis from '@modules/analysis/models/Analysis';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';

const getTrajectoryMetadata = async (
    trajectoryId: string,
    teamClusterId: string
): Promise<RasterTrajectoryMetadata | null> => {
    const availableTimesteps = new Set<number>();

    for await (const fileKey of listRasterPreviews(trajectoryId, teamClusterId)){
        const timestep = parseRasterTimestep(fileKey);
        if(timestep !== null){
            availableTimesteps.add(timestep);
        }
    }

    if(!availableTimesteps.size){
        return null;
    }

    return {
        availableTimesteps: Array.from(availableTimesteps).sort((leftTimestep, rightTimestep) => leftTimestep - rightTimestep)
    };
};

const getAnalysisMetadata = async (
    trajectoryId: string,
    analysisId: string,
    totalFrames: number,
    teamClusterId: string | null
): Promise<RasterAnalysisMetadata | null> => {
    if(!teamClusterId){
        throw ApplicationError.conflict(
            ErrorCodes.ANALYSIS_STORAGE_CLUSTER_REQUIRED,
            'Analysis storage cluster is required'
        );
    }

    const modelsByTimestep = new Map<number, Set<string>>();

    for await (const fileKey of listAnalysisRasterPreviews(trajectoryId, analysisId, teamClusterId)){
        const parsedFrame = parseAnalysisRasterFrameKey(fileKey);
        if(!parsedFrame){
            continue;
        }

        const models = modelsByTimestep.get(parsedFrame.timestep) ?? new Set<string>();
        models.add(parsedFrame.model);
        modelsByTimestep.set(parsedFrame.timestep, models);
    }

    if(!modelsByTimestep.size){
        return null;
    }

    const frames = Array.from(modelsByTimestep, ([timestep, models]) => ({
        timestep,
        availableModels: Array.from(models).sort((leftModel, rightModel) => leftModel.localeCompare(rightModel))
    })).sort((leftFrame, rightFrame) => leftFrame.timestep - rightFrame.timestep);

    return {
        analysisId,
        totalFrames,
        rasterizedFrames: frames.length,
        availableTimesteps: frames.map((frame) => frame.timestep),
        frames
    };
};

export const getRasterMetadata = async (trajectoryId: string, teamId: string): Promise<RasterMetadata | null> => {
    const storageClusterId = await requireTrajectoryStorageCluster(trajectoryId, teamId);
    const totalFrames = await TrajectoryFrame.countBy({ trajectoryId });
    const trajectory = await getTrajectoryMetadata(trajectoryId, storageClusterId);

    const analyses = (await Promise.all(
        (await Analysis.findBy({ trajectory: trajectoryId })).map((analysis) => getAnalysisMetadata(
            trajectoryId,
            analysis.id,
            totalFrames,
            analysis.storageClusterId
        ))
    )).filter((analysis) => analysis !== null);

    if(!trajectory && analyses.length === 0){
        return null;
    }

    const rasterizedFrames = trajectory?.availableTimesteps.length ?? 0;

    return {
        trajectoryId,
        totalFrames,
        rasterizedFrames,
        status: rasterizedFrames >= totalFrames
            ? RasterMetadataStatus.Completed
            : RasterMetadataStatus.Processing,
        trajectory,
        analyses,
        createdAt: new Date(),
        updatedAt: new Date()
    };
};
