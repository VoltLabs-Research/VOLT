import { ErrorCodes } from '@core/constants/error-codes';
import type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';
import { readAnalysisRasterFramePNG, readRasterFramePNG } from '@modules/raster/services/raster-storage';
import { resolveSceneArtifactStorageCluster } from '@modules/trajectory/services/SceneArtifactService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';

export const requireTrajectoryStorageCluster = async (trajectoryId: string, teamId: string): Promise<string> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

    if(!trajectory || trajectory.team !== teamId){
        throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
    }

    if(!trajectory.storageClusterId){
        throw ApplicationError.conflict(
            ErrorCodes.TRAJECTORY_STORAGE_CLUSTER_REQUIRED,
            'Trajectory storage cluster is required'
        );
    }

    return trajectory.storageClusterId;
};

export const getRasterFramePNG = async (
    trajectoryId: string,
    teamId: string,
    timestep: number
): Promise<RasterFrameResult> => readRasterFramePNG(
    trajectoryId,
    timestep,
    await requireTrajectoryStorageCluster(trajectoryId, teamId)
);

export const getAnalysisRasterFramePNG = async (
    trajectoryId: string,
    teamId: string,
    analysisId: string,
    timestep: number,
    model: string
): Promise<RasterFrameResult> => {
    const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

    if(!trajectory || trajectory.team !== teamId){
        throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Trajectory not found');
    }

    const analysis = await Analysis.findOneBy({ id: analysisId });
    if(!analysis || analysis.team !== teamId || analysis.trajectory !== trajectoryId){
        throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
    }

    const teamClusterId = await resolveSceneArtifactStorageCluster({
        trajectoryId,
        analysisId
    });
    if(!teamClusterId){
        throw ApplicationError.conflict(
            ErrorCodes.ANALYSIS_STORAGE_CLUSTER_REQUIRED,
            'Analysis storage cluster is required'
        );
    }

    return readAnalysisRasterFramePNG(trajectoryId, analysisId, timestep, model, teamClusterId);
};
