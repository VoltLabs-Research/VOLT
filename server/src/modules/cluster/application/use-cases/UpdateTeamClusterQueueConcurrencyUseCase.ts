import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { ITeamClusterLifecycleService } from '@modules/cluster/domain/port/ITeamClusterLifecycleService';
import {
    toTeamClusterDTO,
    toTeamClusterQueueConcurrencyDTO,
    toTeamClusterQueueScopeLimitsDTO
} from '@modules/cluster/application/dtos/TeamClusterDTO';
import {
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@modules/cluster/application/dtos/UpdateTeamClusterQueueConcurrencyDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import {
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    ChannelCommands,
    type TeamClusterDaemonQueueConcurrencyApplyPayload
} from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

@Singleton()
export default class UpdateTeamClusterQueueConcurrencyUseCase
    implements IUseCase<UpdateTeamClusterQueueConcurrencyInputDTO, UpdateTeamClusterQueueConcurrencyOutputDTO, ApplicationError> {

    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService,
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient
    ) {}

    async execute(
        input: UpdateTeamClusterQueueConcurrencyInputDTO
    ): Promise<Result<UpdateTeamClusterQueueConcurrencyOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const persistedQueueConcurrency = {
            ...DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
            ...teamCluster.props.queueConcurrency,
            ...input.queueConcurrency
        };

        const persistedQueueScopeLimits = input.queueScopeLimits;

        const updatedTeamCluster = await this.teamClusterRepository.updateById(teamCluster.id, {
            queueConcurrency: persistedQueueConcurrency,
            queueScopeLimits: persistedQueueScopeLimits
        });

        if (!updatedTeamCluster) {
            return Result.fail(ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found'));
        }

        this.teamClusterLifecycleService.publishTeamClusterUpdate(updatedTeamCluster);

        if (updatedTeamCluster.props.status === TeamClusterStatus.Connected) {
            try {
                const queueConcurrencyPayload: TeamClusterDaemonQueueConcurrencyApplyPayload = {
                    queueConcurrency: toTeamClusterQueueConcurrencyDTO(updatedTeamCluster.props.queueConcurrency),
                    queueScopeLimits: toTeamClusterQueueScopeLimitsDTO(updatedTeamCluster.props.queueScopeLimits)
                };
                const queueConcurrencyCommandResult = await this.teamClusterDaemonClient.commandWithSemanticResult<{ accepted?: boolean; reason?: string; }>(
                    updatedTeamCluster.id,
                    ChannelCommands.RuntimeQueueConcurrencyApply,
                    queueConcurrencyPayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (!queueConcurrencyCommandResult.accepted) {
                    logger.warn(`Persisted team cluster queue concurrency but the daemon rejected the live apply request teamClusterId=${updatedTeamCluster.id} teamId=${input.teamId} reason=${queueConcurrencyCommandResult.reason} queueConcurrency=${queueConcurrencyPayload.queueConcurrency}`);
                }
            } catch {
                logger.warn(`Persisted team cluster queue concurrency but failed to request live daemon apply teamClusterId=${updatedTeamCluster.id} teamId=${input.teamId} queueConcurrency=${updatedTeamCluster.props.queueConcurrency}`);
            }
        }

        return Result.ok({
            message: 'Queue settings saved.',
            teamCluster: toTeamClusterDTO(updatedTeamCluster)
        });
    }
}
