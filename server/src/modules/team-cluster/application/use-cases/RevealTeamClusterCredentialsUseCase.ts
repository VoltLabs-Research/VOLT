import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@modules/team-cluster/application/dtos/RevealTeamClusterCredentialsDTO';
import { TeamClusterCredentialServicesDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
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

const decryptRequiredValue = (
    value: string | undefined,
    teamClusterId: string,
    field: string,
    teamClusterCredentialsCipher: ITeamClusterCredentialsCipher
): string => {
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
        const teamCluster = await this.teamClusterRepository.findByIdWithSensitiveData(input.teamClusterId);
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

        const services = teamCluster.props.services;
        const revealedServices: TeamClusterCredentialServicesDTO = {
            minio: {
                port: services.minio.port,
                username: decryptRequiredValue(
                    services.minio.username,
                    teamCluster._id,
                    'services.minio.username',
                    this.teamClusterCredentialsCipher
                ),
                password: decryptRequiredValue(
                    services.minio.password,
                    teamCluster._id,
                    'services.minio.password',
                    this.teamClusterCredentialsCipher
                )
            },
            redis: {
                port: services.redis.port,
                username: decryptRequiredValue(
                    services.redis.username,
                    teamCluster._id,
                    'services.redis.username',
                    this.teamClusterCredentialsCipher
                ),
                password: decryptRequiredValue(
                    services.redis.password,
                    teamCluster._id,
                    'services.redis.password',
                    this.teamClusterCredentialsCipher
                )
            },
            mongodb: {
                port: services.mongodb.port,
                username: decryptRequiredValue(
                    services.mongodb.username,
                    teamCluster._id,
                    'services.mongodb.username',
                    this.teamClusterCredentialsCipher
                ),
                password: decryptRequiredValue(
                    services.mongodb.password,
                    teamCluster._id,
                    'services.mongodb.password',
                    this.teamClusterCredentialsCipher
                )
            },
            daemon: {
                port: services.daemon.port,
                password: decryptRequiredValue(
                    services.daemon.password,
                    teamCluster._id,
                    'services.daemon.password',
                    this.teamClusterCredentialsCipher
                )
            }
        };

        logger.info({
            action: 'team-cluster.credentials-reveal',
            teamClusterId: input.teamClusterId,
            teamId: input.teamId,
            userId: input.userId
        }, 'Team cluster credentials revealed');

        return Result.ok({
            teamClusterId: input.teamClusterId,
            services: revealedServices
        });
    }
};
