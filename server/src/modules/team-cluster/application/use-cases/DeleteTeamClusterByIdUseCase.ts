import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import {
    DeleteTeamClusterByIdInputDTO,
    DeleteTeamClusterByIdOutputDTO
} from '@modules/team-cluster/application/dtos/DeleteTeamClusterByIdDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { assertConfirmedPassword } from '@modules/team-cluster/utilities/assertConfirmedPassword';
import { buildManualTeamClusterUninstallCommand } from '@modules/team-cluster/utilities/installRoot';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { TeamClusterDaemonSemanticCommandResult } from '@shared/infrastructure/services/TeamClusterDaemonClient';

const shouldRequireManualUninstall = (status: TeamClusterStatus, installedVersion: string | null, daemonPort: number | null): boolean => {
    if (status === TeamClusterStatus.WaitingForConnection) {
        return installedVersion !== null || daemonPort !== null;
    }

    return status !== TeamClusterStatus.Connected;
};

@injectable()
export default class DeleteTeamClusterByIdUseCase implements IUseCase<DeleteTeamClusterByIdInputDTO, DeleteTeamClusterByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,

        @inject(AUTH_TOKENS.PasswordHasher)
        private readonly passwordHasher: IPasswordHasher,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: DeleteTeamClusterByIdInputDTO): Promise<Result<DeleteTeamClusterByIdOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const passwordError = await assertConfirmedPassword({
            userRepository: this.userRepository,
            passwordHasher: this.passwordHasher,
            userId: input.userId,
            password: input.password
        });
        if (passwordError) {
            return Result.fail(passwordError);
        }

        if (teamCluster.props.status === TeamClusterStatus.Deleting) {
            return Result.fail(ApplicationError.conflict(
                'TeamCluster::DeletionAlreadyInProgress',
                'Team cluster deletion is already in progress'
            ));
        }

        if (teamCluster.props.status === TeamClusterStatus.Connected) {
            let uninstallCommandResult: TeamClusterDaemonSemanticCommandResult<{ accepted?: boolean; reason?: string; message?: string; }>;

            try {
                uninstallCommandResult = await this.teamClusterDaemonClient.commandWithSemanticResult<{ accepted?: boolean; reason?: string; message?: string; }>(
                    input.teamClusterId,
                    'runtime.uninstall',
                    {
                        reason: `Delete requested by user ${input.userId}`
                    },
                    {
                        timeoutClass: 'long-running-control-plane'
                    }
                );
            } catch (error: unknown) {
                logger.warn({
                    action: 'team-cluster.delete.remote-request-failed',
                    teamClusterId: input.teamClusterId,
                    teamId: input.teamId,
                    userId: input.userId,
                    err: error
                }, 'Failed to request remote team cluster uninstall');

                return Result.fail(ApplicationError.conflict(
                    'TeamCluster::RemoteUninstallRequestFailed',
                    'Failed to request uninstall from the connected cluster daemon'
                ));
            }

            if (!uninstallCommandResult.accepted) {
                const rejectionReason = uninstallCommandResult.reason
                    || uninstallCommandResult.data?.reason
                    || uninstallCommandResult.data?.message
                    || 'The daemon rejected the uninstall request.';

                logger.warn({
                    action: 'team-cluster.delete.remote-request-rejected',
                    teamClusterId: input.teamClusterId,
                    teamId: input.teamId,
                    userId: input.userId,
                    reason: rejectionReason
                }, 'Cluster daemon rejected runtime.uninstall command');

                return Result.fail(ApplicationError.conflict(
                    'TeamCluster::RemoteUninstallRejected',
                    rejectionReason
                ));
            }

            const updatedTeamCluster = await this.teamClusterLifecycleService.markDeleting(input.teamClusterId);

            logger.info({
                action: 'team-cluster.delete.remote-requested',
                teamClusterId: input.teamClusterId,
                teamId: input.teamId,
                userId: input.userId
            }, 'Team cluster uninstall requested from daemon');

            return Result.ok({
                success: true,
                deleted: false,
                manualUninstallRequired: false,
                message: 'Remote uninstall requested. Volt will remove the cluster after the daemon confirms cleanup or the connection times out.',
                teamCluster: updatedTeamCluster
            });
        }

        const manualUninstallRequired = shouldRequireManualUninstall(
            teamCluster.props.status,
            teamCluster.props.installedVersion,
            teamCluster.props.services.daemon.port
        );
        const manualUninstallCommand = manualUninstallRequired
            ? buildManualTeamClusterUninstallCommand(teamCluster.id, teamCluster.props.installRoot)
            : undefined;

        await this.teamClusterLifecycleService.deleteTeamCluster(teamCluster);

        logger.info({
            action: 'team-cluster.delete.control-plane-only',
            teamClusterId: input.teamClusterId,
            teamId: input.teamId,
            userId: input.userId,
            manualUninstallRequired
        }, 'Team cluster deleted without remote uninstall confirmation');

        return Result.ok({
            success: true,
            deleted: true,
            manualUninstallRequired,
            message: manualUninstallRequired
                ? 'Volt removed the cluster from the control plane. Remote uninstall could not be confirmed, so run the manual uninstall command on the host if the stack is still installed.'
                : 'Team cluster deleted from the control plane.',
            manualUninstallCommand
        });
    }
};
