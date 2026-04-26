import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type { IRasterFrameReader, RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';
import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import { resolveTrajectoryStorageClusterId } from '@modules/cluster/application/utilities/cluster-location';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import { resolveSceneArtifactStorageCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-storage-cluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class RasterFrameService implements IRasterFrameReader {
    constructor(
        
        private readonly rasterStorage: RasterStorageService,

        
        private readonly trajectoryRepository: TrajectoryRepository,

        
        private readonly analysisRepository: AnalysisRepository
    ) {}

    async getRasterFramePNG(trajectoryId: string, teamId: string, timestep: number): Promise<RasterFrameResult> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        return this.rasterStorage.getRasterFramePNG(
            trajectoryId,
            timestep,
            resolveTrajectoryStorageClusterId(trajectory.props)
        );
    }

    async getAnalysisRasterFramePNG(
        trajectoryId: string,
        teamId: string,
        analysisId: string,
        timestep: number,
        model: string
    ): Promise<RasterFrameResult> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis || analysis.props.team !== teamId || analysis.props.trajectory !== trajectoryId) {
            throw ApplicationError.notFound('Analysis::NotFound', 'Analysis not found');
        }

        const teamClusterId = await resolveSceneArtifactStorageCluster({
            trajectoryId,
            analysisId,
            analysisRepository: this.analysisRepository,
            trajectoryRepository: this.trajectoryRepository
        });

        return this.rasterStorage.getAnalysisRasterFramePNG(
            trajectoryId,
            analysisId,
            timestep,
            model,
            teamClusterId
        );
    }
};
