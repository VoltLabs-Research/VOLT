import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@modules/team-cluster/application/dtos/RevealTeamClusterCredentialsDTO';
import { TeamClusterCredentialServicesDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import { requireOwnedTeamClusterWithSensitiveData } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { assertConfirmedPassword } from '@modules/team-cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';

const decryptRequiredValue = async (
    value: string | undefined,
    teamClusterId: string,
    field: string,
    teamClusterCredentialsCipher: ITeamClusterCredentialsCipher
): Promise<string> => {
    if (!value) {
        throw ApplicationError.internalServerError(`Missing sensitive field ${field} for team cluster ${teamClusterId}`);
    }

    return teamClusterCredentialsCipher.decrypt(value);
};

@injectable()
export default class RevealTeamClusterCredentialsUseCase implements IUseCase<RevealTeamClusterCredentialsInputDTO, RevealTeamClusterCredentialsOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher)
        private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher,

        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,

        @inject(AUTH_TOKENS.PasswordHasher)
        private readonly passwordHasher: IPasswordHasher
    ){}

    async execute(input: RevealTeamClusterCredentialsInputDTO): Promise<Result<RevealTeamClusterCredentialsOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamClusterWithSensitiveData(this.teamClusterRepository, input);
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

        const services = teamCluster.props.services;
        const revealedServices: TeamClusterCredentialServicesDTO = {
            minio: {
                port: services.minio.port,
                username: await decryptRequiredValue(
                    services.minio.username,
                    teamCluster._id,
                    'services.minio.username',
                    this.teamClusterCredentialsCipher
                ),
                password: await decryptRequiredValue(
                    services.minio.password,
                    teamCluster._id,
                    'services.minio.password',
                    this.teamClusterCredentialsCipher
                )
            },
            redis: {
                port: services.redis.port,
                username: await decryptRequiredValue(
                    services.redis.username,
                    teamCluster._id,
                    'services.redis.username',
                    this.teamClusterCredentialsCipher
                ),
                password: await decryptRequiredValue(
                    services.redis.password,
                    teamCluster._id,
                    'services.redis.password',
                    this.teamClusterCredentialsCipher
                )
            },
            mongodb: {
                port: services.mongodb.port,
                username: await decryptRequiredValue(
                    services.mongodb.username,
                    teamCluster._id,
                    'services.mongodb.username',
                    this.teamClusterCredentialsCipher
                ),
                password: await decryptRequiredValue(
                    services.mongodb.password,
                    teamCluster._id,
                    'services.mongodb.password',
                    this.teamClusterCredentialsCipher
                )
            },
            daemon: {
                port: services.daemon.port,
                password: await decryptRequiredValue(
                    services.daemon.password,
                    teamCluster._id,
                    'services.daemon.password',
                    this.teamClusterCredentialsCipher
                )
            }
        };

        logger.info(`Team cluster credentials revealed teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return Result.ok({
            teamClusterId: input.teamClusterId,
            services: revealedServices
        });
    }
};
