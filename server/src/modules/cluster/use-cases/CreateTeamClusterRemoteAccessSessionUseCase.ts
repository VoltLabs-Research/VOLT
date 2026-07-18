import type { IPasswordHasher } from '@modules/auth/ports/IPasswordHasher';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/ports/ITeamClusterRepository';
import type { ITeamClusterRemoteAccessSessionService } from '@modules/cluster/ports/ITeamClusterRemoteAccessSessionService';
import {
    CreateTeamClusterRemoteAccessSessionInputDTO,
    CreateTeamClusterRemoteAccessSessionOutputDTO
} from '@modules/cluster/dtos/CreateTeamClusterRemoteAccessSessionDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/utilities/team-cluster-ownership';
import { assertConfirmedPassword } from '@modules/cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

@Singleton()
export default class CreateTeamClusterRemoteAccessSessionUseCase implements IUseCase<CreateTeamClusterRemoteAccessSessionInputDTO, CreateTeamClusterRemoteAccessSessionOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(AUTH_CONTRACT_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_CONTRACT_TOKENS.PasswordHasher) private readonly passwordHasher: IPasswordHasher,
        @inject(CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService) private readonly sessionService: ITeamClusterRemoteAccessSessionService
    ) {}

    async execute(
        input: CreateTeamClusterRemoteAccessSessionInputDTO
    ): Promise<CreateTeamClusterRemoteAccessSessionOutputDTO> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            throw teamCluster;
        }

        const passwordError = await assertConfirmedPassword({
            userRepository: this.userRepository,
            passwordHasher: this.passwordHasher,
            userId: input.userId,
            password: input.password
        });
        if (passwordError) {
            throw passwordError;
        }

        const session = this.sessionService.createSession({
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });

        logger.info(`Created team cluster remote access session teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} target=${input.target}`);

        return {
            session
        };
    }
}
