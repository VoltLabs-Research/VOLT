import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { ExecutePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePluginUseCase';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { resolveConnectedTeamCluster } from '@modules/trajectory/utilities/team-cluster/resolve-connected-team-cluster';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import { CreateAnalysisInputDTO, CreateAnalysisOutputDTO } from '@modules/analysis/application/dtos/CreateAnalysisDTO';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export class CreateAnalysisUseCase implements IUseCase<CreateAnalysisInputDTO, CreateAnalysisOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(ExecutePluginUseCase)
        private readonly executePluginUseCase: ExecutePluginUseCase
    ) {}

    async execute(input: CreateAnalysisInputDTO): Promise<Result<CreateAnalysisOutputDTO>> {
        const trajectory = await this.trajectoryRepository.findById(input.trajectoryId);
        if (!trajectory) {
            return Result.fail(ApplicationError.notFound('Trajectory::NotFound', 'Trajectory not found'));
        }

        const teamCluster = await resolveConnectedTeamCluster(this.teamClusterRepository, {
            teamId: input.teamId,
            requestedTeamClusterId: input.teamClusterId || trajectory.props.teamCluster
        });

        const executionResult = await this.executePluginUseCase.execute({
            pluginId: input.pluginId,
            trajectoryId: input.trajectoryId,
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: teamCluster.id,
            config: input.config
        });
        if (!executionResult.success) {
            return Result.fail(executionResult.error);
        }

        const analysis = await this.analysisRepository.findById(executionResult.value.analysisId);
        if (!analysis) {
            return Result.fail(ApplicationError.notFound('Analysis::NotFound', 'Analysis not found after creation'));
        }

        return Result.ok({
            analysis: {
                _id: analysis._id,
                trajectory: analysis.props.trajectory,
                plugin: analysis.props.plugin,
                teamCluster: analysis.props.teamCluster,
                config: analysis.props.config,
                status: 'pending',
                createdAt: new Date()
            }
        });
    }
};
