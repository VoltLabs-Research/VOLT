import type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';
import { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import { resolveSceneArtifactStorageCluster } from '@modules/trajectory/services/SceneArtifactService';
import ApplicationError from '@shared/application/errors/ApplicationError';

import Analysis from '@modules/analysis/models/Analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';

export class RasterFrameService{
    constructor(
        private readonly rasterStorage: RasterStorageService
    ){}

    async getRasterFramePNG(trajectoryId: string, teamId: string, timestep: number): Promise<RasterFrameResult>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if(!trajectory || trajectory.team !== teamId){
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }
        const storageClusterId = trajectory.storageClusterId;
        if(!storageClusterId){
            throw ApplicationError.conflict(
                'Trajectory::StorageClusterRequired',
                'Trajectory storage cluster is required'
            );
        }

        return this.rasterStorage.getRasterFramePNG(
            trajectoryId,
            timestep,
            storageClusterId
        );
    }

    async getAnalysisRasterFramePNG(
        trajectoryId: string,
        teamId: string,
        analysisId: string,
        timestep: number,
        model: string
    ): Promise<RasterFrameResult>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });

        if(!trajectory || trajectory.team !== teamId){
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const analysis = await Analysis.findOneBy({ id: analysisId });
        if(!analysis || analysis.team !== teamId || analysis.trajectory !== trajectoryId){
            throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found');
        }

        const teamClusterId = await resolveSceneArtifactStorageCluster({
            trajectoryId,
            analysisId
        });
        if(!teamClusterId){
            throw ApplicationError.conflict(
                'Analysis::StorageClusterRequired',
                'Analysis storage cluster is required'
            );
        }

        return this.rasterStorage.getAnalysisRasterFramePNG(
            trajectoryId,
            analysisId,
            timestep,
            model,
            teamClusterId
        );
    }
}
