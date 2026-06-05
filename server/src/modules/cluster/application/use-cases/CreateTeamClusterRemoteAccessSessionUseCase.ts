import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { ITeamClusterRemoteAccessSessionService } from '@modules/cluster/domain/port/ITeamClusterRemoteAccessSessionService';
import {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from '@modules/cluster/application/dtos/CreateTeamClusterRemoteAccessSessionDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import { assertConfirmedPassword } from '@modules/cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

@Singleton()
export default class CreateTeamClusterRemoteAccessSessionUseCase implements IUseCase<
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.PasswordHasher) private readonly passwordHasher: IPasswordHasher,
        @inject(CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService) private readonly sessionService: ITeamClusterRemoteAccessSessionService
    ) {}

    async execute(
        input: CreateTeamClusterRemoteAccessSessionInputDTO
    ): Promise<Result<CreateTeamClusterRemoteAccessSessionOutputDTO, ApplicationError>> {
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

        const session = this.sessionService.createSession({
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });

        logger.info(`Created team cluster remote access session teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} target=${input.target}`);

        return Result.ok({
            session
        });
    }
}
