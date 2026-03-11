import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import {
    RequestTeamClusterUpdateInputDTO,
    RequestTeamClusterUpdateOutputDTO
} from '@modules/team-cluster/application/dtos/RequestTeamClusterUpdateDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { assertConfirmedPassword } from '@modules/team-cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

const DAEMON_IMAGE_REPOSITORY = 'ghcr.io/voltlabs-research/volt-cluster-daemon';

const UPDATABLE_STATUSES: TeamClusterStatus[] = [
    TeamClusterStatus.Connected,
    TeamClusterStatus.UpdateFailed
];

/**
 * Builds the fully-qualified Docker image reference for the given version.
 * Edge builds use the `:main` tag; stable builds use the version tag directly.
 */
const buildTargetImage = (targetVersion: string, isEdge: boolean): string => {
    const tag = isEdge ? 'main' : targetVersion;
    return `${DAEMON_IMAGE_REPOSITORY}:${tag}`;
};

@injectable()
export default class RequestTeamClusterUpdateUseCase
    implements IUseCase<RequestTeamClusterUpdateInputDTO, RequestTeamClusterUpdateOutputDTO, ApplicationError> {

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
    ) {}

    async execute(
        input: RequestTeamClusterUpdateInputDTO
    ): Promise<Result<RequestTeamClusterUpdateOutputDTO, ApplicationError>> {
        const teamCluster = await this.teamClusterRepository.findById(input.teamClusterId);
        if (!teamCluster || teamCluster.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::NotFound',
                'Team cluster not found'
            ));
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

        if (!UPDATABLE_STATUSES.includes(teamCluster.props.status)) {
            return Result.fail(ApplicationError.conflict(
                'TeamCluster::NotUpdatable',
                `Cluster update can only be requested when the cluster is connected or in update-failed state. Current status: ${teamCluster.props.status}`
            ));
        }

        const targetImage = buildTargetImage(input.targetVersion, input.isEdge);

        try {
            await this.teamClusterDaemonClient.command<{ accepted: boolean }>(
                input.teamClusterId,
                'runtime.update',
                {
                    targetImage,
                    targetVersion: input.targetVersion
                }
            );
        } catch (error: unknown) {
            logger.warn({
                action: 'team-cluster.update.remote-request-failed',
                teamClusterId: input.teamClusterId,
                teamId: input.teamId,
                userId: input.userId,
                err: error
            }, 'Failed to send runtime.update command to cluster daemon');

            return Result.fail(ApplicationError.conflict(
                'TeamCluster::UpdateRequestFailed',
                'Failed to send update command to the connected cluster daemon'
            ));
        }

        const updatedTeamCluster = await this.teamClusterLifecycleService.markUpdating(input.teamClusterId);

        logger.info({
            action: 'team-cluster.update.requested',
            teamClusterId: input.teamClusterId,
            teamId: input.teamId,
            userId: input.userId,
            targetVersion: input.targetVersion,
            targetImage,
            isEdge: input.isEdge
        }, 'Team cluster update requested');

        return Result.ok({
            message: 'Update requested. The cluster will reconnect with the new version shortly.',
            teamCluster: updatedTeamCluster
        });
    }
};
