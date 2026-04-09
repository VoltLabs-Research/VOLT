import {
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@modules/team-cluster/application/dtos/UpdateTeamClusterQueueConcurrencyDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    TEAM_CLUSTER_DAEMON_COMMAND,
    type TeamClusterDaemonQueueConcurrencyApplyPayload
} from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

@injectable()
export default class UpdateTeamClusterQueueConcurrencyUseCase
    implements IUseCase<UpdateTeamClusterQueueConcurrencyInputDTO, UpdateTeamClusterQueueConcurrencyOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(
        input: UpdateTeamClusterQueueConcurrencyInputDTO
    ): Promise<Result<UpdateTeamClusterQueueConcurrencyOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const updatedTeamCluster = await this.teamClusterRepository.updateById(teamCluster.id, {
            queueConcurrency: input.queueConcurrency,
            queueScopeLimits: input.queueScopeLimits
        });

        if (!updatedTeamCluster) {
            return Result.fail(ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found'));
        }

        this.teamClusterLifecycleService.publishTeamClusterUpdate(updatedTeamCluster);

        if (updatedTeamCluster.props.status === TeamClusterStatus.Connected) {
            try {
                const queueConcurrencyPayload: TeamClusterDaemonQueueConcurrencyApplyPayload = {
                    queueConcurrency: {
                        ...updatedTeamCluster.props.queueConcurrency
                    },
                    queueScopeLimits: {
                        analysisProcessing: {
                            ...updatedTeamCluster.props.queueScopeLimits.analysisProcessing
                        },
                        artifactUpload: {
                            ...updatedTeamCluster.props.queueScopeLimits.artifactUpload
                        },
                        trajectoryGlbConversion: {
                            ...updatedTeamCluster.props.queueScopeLimits.trajectoryGlbConversion
                        },
                        cloudUpload: {
                            ...updatedTeamCluster.props.queueScopeLimits.cloudUpload
                        },
                        trajectoryCompression: {
                            ...updatedTeamCluster.props.queueScopeLimits.trajectoryCompression
                        }
                    }
                };
                const queueConcurrencyCommandResult = await this.teamClusterDaemonClient.commandWithSemanticResult<{ accepted?: boolean; reason?: string; }>(
                    updatedTeamCluster.id,
                    TEAM_CLUSTER_DAEMON_COMMAND.runtime.queueConcurrency.apply,
                    queueConcurrencyPayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (!queueConcurrencyCommandResult.accepted) {
                    logger.warn({
                        action: 'team-cluster.queue-concurrency.apply-rejected',
                        teamClusterId: updatedTeamCluster.id,
                        teamId: input.teamId,
                        reason: queueConcurrencyCommandResult.reason,
                        queueConcurrency: queueConcurrencyPayload.queueConcurrency
                    }, 'Persisted team cluster queue concurrency but the daemon rejected the live apply request');
                }
            } catch (error: unknown) {
                logger.warn({
                    action: 'team-cluster.queue-concurrency.apply-failed',
                    teamClusterId: updatedTeamCluster.id,
                    teamId: input.teamId,
                    queueConcurrency: updatedTeamCluster.props.queueConcurrency,
                    err: error
                }, 'Persisted team cluster queue concurrency but failed to request live daemon apply');
            }
        }

        return Result.ok({
            message: 'Queue settings saved.',
            teamCluster: toTeamClusterDTO(updatedTeamCluster)
        });
    }
}
