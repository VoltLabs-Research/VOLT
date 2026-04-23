import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import BcryptPasswordHasher from '@modules/auth/infrastructure/services/BcryptPasswordHasher';
import {
    DeleteTeamClusterByIdInputDTO,
    DeleteTeamClusterByIdOutputDTO
} from '@modules/team-cluster/application/dtos/DeleteTeamClusterByIdDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { assertConfirmedPassword } from '@modules/team-cluster/utilities/assertConfirmedPassword';
import { buildManualTeamClusterUninstallCommand } from '@modules/team-cluster/utilities/installRoot';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import type { TeamClusterDaemonSemanticCommandResult } from '@shared/infrastructure/services/TeamClusterDaemonClient';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable } from 'tsyringe';

const shouldRequireManualUninstall = (status: TeamClusterStatus, installedVersion: string | null, daemonPort: number | null): boolean => {
    if (status === TeamClusterStatus.WaitingForConnection) {
        return installedVersion !== null || daemonPort !== null;
    }

    return status !== TeamClusterStatus.Connected;
};

@injectable()
export default class DeleteTeamClusterByIdUseCase implements IUseCase<DeleteTeamClusterByIdInputDTO, DeleteTeamClusterByIdOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly userRepository: UserRepository,

        
        private readonly passwordHasher: BcryptPasswordHasher,

        
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        
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
                    ChannelCommands.RuntimeUninstall,
                    {
                        reason: `Delete requested by user ${input.userId}`
                    },
                    {
                        timeoutClass: 'long-running-control-plane'
                    }
                );
            } catch (error: unknown) {
                logger.warn(`Failed to request remote team cluster uninstall teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

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

                logger.warn(`Cluster daemon rejected runtime.uninstall command teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} reason=${rejectionReason}`);

                return Result.fail(ApplicationError.conflict(
                    'TeamCluster::RemoteUninstallRejected',
                    rejectionReason
                ));
            }

            const updatedTeamCluster = await this.teamClusterLifecycleService.markDeleting(input.teamClusterId);

            logger.info(`Team cluster uninstall requested from daemon teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

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

        logger.info(`Team cluster deleted without remote uninstall confirmation teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} manualUninstallRequired=${manualUninstallRequired}`);

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
