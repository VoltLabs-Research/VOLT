import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import {
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO
} from '@modules/team-cluster/application/dtos/UpdateTeamClusterRoleDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import {
    TEAM_CLUSTER_DAEMON_COMMAND,
    type TeamClusterDaemonRoleApplyPayload,
    type TeamClusterDaemonRoleApplyResult
} from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

@injectable()
export default class UpdateTeamClusterRoleUseCase implements IUseCase<
    UpdateTeamClusterRoleInputDTO,
    UpdateTeamClusterRoleOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
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
                    TEAM_CLUSTER_DAEMON_COMMAND.runtime.role.apply,
                    rolePayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (liveApplyResult.accepted) {
                    const roleResult = liveApplyResult.data;
                    updatedTeamCluster = (await this.teamClusterRepository.updateById(updatedTeamCluster.id, {
                        roleConfig: roleResult.roleConfig,
                        effectiveCapabilities: roleResult.effectiveCapabilities
                    })) ?? updatedTeamCluster;

                    this.teamClusterLifecycleService.publishTeamClusterUpdate(updatedTeamCluster);
                } else {
                    logger.warn({
                        action: 'team-cluster.role.apply-rejected',
                        teamClusterId: updatedTeamCluster.id,
                        teamId: input.teamId,
                        role: input.role,
                        reason: liveApplyResult.reason
                    }, 'Persisted desired role but the daemon rejected the live apply request');
                }
            } catch (error: unknown) {
                logger.warn({
                    action: 'team-cluster.role.apply-failed',
                    teamClusterId: updatedTeamCluster.id,
                    teamId: input.teamId,
                    role: input.role,
                    err: error
                }, 'Persisted desired role but failed to request live daemon role apply');
            }
        }

        return Result.ok({
            message: 'Team cluster role saved.',
            teamCluster: toTeamClusterDTO(updatedTeamCluster)
        });
    }
}
