import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from '@modules/team-cluster/application/dtos/CreateTeamClusterRemoteAccessSessionDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterRemoteAccessSessionService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import { assertConfirmedPassword } from '@modules/team-cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';

@injectable()
export default class CreateTeamClusterRemoteAccessSessionUseCase implements IUseCase<
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,

        @inject(AUTH_TOKENS.PasswordHasher)
        private readonly passwordHasher: IPasswordHasher,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService)
        private readonly sessionService: TeamClusterRemoteAccessSessionService
    ) {}

    async execute(
        input: CreateTeamClusterRemoteAccessSessionInputDTO
    ): Promise<Result<CreateTeamClusterRemoteAccessSessionOutputDTO, ApplicationError>> {
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

        const session = this.sessionService.createSession({
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });

        logger.info({
            action: 'team-cluster.remote-access.session-created',
            teamClusterId: input.teamClusterId,
            teamId: input.teamId,
            userId: input.userId,
            target: input.target
        }, 'Created team cluster remote access session');

        return Result.ok({
            session
        });
    }
}
