import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import {
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO
} from '@modules/cluster/application/dtos/UpdateTeamClusterRoleDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import {
    ChannelCommands,
    type TeamClusterDaemonRoleApplyPayload,
    type TeamClusterDaemonRoleApplyResult
} from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

@Singleton()
export default class UpdateTeamClusterRoleUseCase implements IUseCase<
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async execute(
        input: UpdateTeamClusterRoleInputDTO
    ): Promise<Result<UpdateTeamClusterRoleOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const currentRoleConfig = teamCluster.props.roleConfig;
        const nextRoleConfig = {
            ...currentRoleConfig,
            desiredRole: input.role,
            runtimeVersion: currentRoleConfig.desiredRole === input.role
                ? currentRoleConfig.runtimeVersion
                : currentRoleConfig.runtimeVersion + 1
        };

        let updatedTeamCluster = await this.teamClusterRepository.updateById(teamCluster.id, {
            roleConfig: nextRoleConfig
        });

        if (!updatedTeamCluster) {
            return Result.fail(ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found'));
        }

        this.teamClusterLifecycleService.publishTeamClusterUpdate(updatedTeamCluster);

        if (updatedTeamCluster.props.status === TeamClusterStatus.Connected) {
            try {
                const rolePayload: TeamClusterDaemonRoleApplyPayload = {
                    roleConfig: updatedTeamCluster.props.roleConfig
                };
                const liveApplyResult = await this.teamClusterDaemonClient.commandWithSemanticResult<TeamClusterDaemonRoleApplyResult>(
                    updatedTeamCluster.id,
                    ChannelCommands.RuntimeRoleApply,
                    rolePayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (liveApplyResult.accepted) {
                    const roleResult = liveApplyResult.data;
                    updatedTeamCluster = (await this.teamClusterRepository.updateById(updatedTeamCluster.id, {
                        roleConfig: roleResult.roleConfig
                    })) ?? updatedTeamCluster;

                    this.teamClusterLifecycleService.publishTeamClusterUpdate(updatedTeamCluster);
                } else {
                    logger.warn(`Persisted desired role but the daemon rejected the live apply request teamClusterId=${updatedTeamCluster.id} teamId=${input.teamId} role=${input.role} reason=${liveApplyResult.reason}`);
                }
            } catch {
                logger.warn(`Persisted desired role but failed to request live daemon role apply teamClusterId=${updatedTeamCluster.id} teamId=${input.teamId} role=${input.role}`);
            }
        }

        return Result.ok({
            message: 'Team cluster role saved.',
            teamCluster: toTeamClusterDTO(updatedTeamCluster)
        });
    }
}
