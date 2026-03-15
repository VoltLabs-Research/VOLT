import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { resolveSceneArtifactTeamCluster } from '@modules/trajectory/utilities/scene-artifacts/resolve-scene-artifact-team-cluster';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IRasterFrameReader, RasterFrameResult } from '@modules/raster/domain/port/IRasterFrameReader';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export class RasterFrameService implements IRasterFrameReader {
    constructor(
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ) {}

    async getRasterFramePNG(trajectoryId: string, teamId: string, timestep: number): Promise<RasterFrameResult> {
        const trajectory = await this.trajectoryRepository.findById(trajectoryId);

        if (!trajectory || trajectory.props.team !== teamId) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found');
        }

        return this.rasterStorage.getRasterFramePNG(
            trajectoryId,
            timestep,
            trajectory.props.teamCluster
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

        const teamClusterId = await resolveSceneArtifactTeamCluster({
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
