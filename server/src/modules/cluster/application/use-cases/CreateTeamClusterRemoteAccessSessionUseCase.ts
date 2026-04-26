import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import BcryptPasswordHasher from '@modules/auth/infrastructure/services/BcryptPasswordHasher';
import {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from '@modules/cluster/application/dtos/CreateTeamClusterRemoteAccessSessionDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterRemoteAccessSessionService from '@modules/cluster/infrastructure/services/TeamClusterRemoteAccessSessionService';
import { assertConfirmedPassword } from '@modules/cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

@Singleton()
export default class CreateTeamClusterRemoteAccessSessionUseCase implements IUseCase<
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly userRepository: UserRepository,

        
        private readonly passwordHasher: BcryptPasswordHasher,

        
        private readonly sessionService: TeamClusterRemoteAccessSessionService
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
