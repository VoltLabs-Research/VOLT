import type { RasterFrameResult } from '@shared/contracts/types/RasterFrame';
import { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { resolveSceneArtifactStorageCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-storage-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';

export class RasterFrameService {
    constructor(
        private readonly rasterStorage: RasterStorageService,
        private readonly analysisRepository: IAnalysisRepository
    ) {}

    async getRasterFramePNG(trajectoryId: string, teamId: string, timestep: number): Promise<RasterFrameResult> {
        const trajectory = await TrajectoryModel.findById(trajectoryId);

        if (!trajectory || trajectory.team.toString() !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }
        const storageClusterId = trajectory.storageClusterId?.toString();
        if (!storageClusterId) {
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
    ): Promise<RasterFrameResult> {
        const trajectory = await TrajectoryModel.findById(trajectoryId);

        if (!trajectory || trajectory.team.toString() !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis || analysis.props.team !== teamId || analysis.props.trajectory !== trajectoryId) {
            throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found');
        }

        const teamClusterId = await resolveSceneArtifactStorageCluster({
            trajectoryId,
            analysisId,
            analysisRepository: this.analysisRepository
        });
        if (!teamClusterId) {
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
