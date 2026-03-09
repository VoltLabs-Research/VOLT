import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { resolveConnectedTeamCluster } from '@modules/trajectory/utilities/team-cluster/resolve-connected-team-cluster';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { IUseCase } from '@shared/application/IUseCase';
import { CreateAnalysisInputDTO, CreateAnalysisOutputDTO } from '@modules/analysis/application/dtos/CreateAnalysisDTO';
import AnalysisCreatedEvent from '@modules/analysis/domain/events/AnalysisCreatedEvent';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

@injectable()
export class CreateAnalysisUseCase implements IUseCase<CreateAnalysisInputDTO, CreateAnalysisOutputDTO> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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

        const analysis = await this.analysisRepository.create({
            trajectory: input.trajectoryId,
            plugin: input.pluginId,
            clusterId: teamCluster.id,
            teamCluster: teamCluster.id,
            config: input.config,
            createdBy: input.userId,
            team: input.teamId,
            totalFrames: 0,
            completedFrames: 0
        });

        await this.eventBus.publish(new AnalysisCreatedEvent({
            analysisId: analysis.id,
            trajectoryId: input.trajectoryId,
            pluginId: input.pluginId,
            teamId: input.teamId,
            config: input.config,
            status: 'pending',
            createdAt: new Date()
        }));

        try {
            await this.teamClusterDaemonClient.request(teamCluster.id, '/api/orchestration/analysis/start', {
                method: 'POST',
                body: {
                    analysisId: analysis.id,
                    payload: {
                        trajectoryId: input.trajectoryId,
                        pluginId: input.pluginId,
                        config: input.config,
                        teamId: input.teamId,
                        userId: input.userId
                    }
                }
            });
        } catch (error: unknown) {
            await this.analysisRepository.updateById(analysis.id, {
                status: 'failed'
            });

            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to route analysis to the team cluster daemon'));
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
