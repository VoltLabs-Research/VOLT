import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import {
    UpdateTeamClusterQueueConcurrencyInputDTO,
    UpdateTeamClusterQueueConcurrencyOutputDTO
} from '@modules/team-cluster/application/dtos/UpdateTeamClusterQueueConcurrencyDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    ChannelCommands,
    type TeamClusterDaemonQueueConcurrencyApplyPayload
} from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@Singleton()
export default class UpdateTeamClusterQueueConcurrencyUseCase
    implements IUseCase<UpdateTeamClusterQueueConcurrencyInputDTO, UpdateTeamClusterQueueConcurrencyOutputDTO, ApplicationError> {

    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        
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
            } catch (error: unknown) {
                logger.warn(`Persisted team cluster queue concurrency but failed to request live daemon apply teamClusterId=${updatedTeamCluster.id} teamId=${input.teamId} queueConcurrency=${updatedTeamCluster.props.queueConcurrency}`);
            }
        }

        return Result.ok({
            message: 'Queue settings saved.',
            teamCluster: toTeamClusterDTO(updatedTeamCluster)
        });
    }
}
