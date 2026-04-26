import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import BcryptPasswordHasher from '@modules/auth/infrastructure/services/BcryptPasswordHasher';
import {
    RevealTeamClusterCredentialsInputDTO,
    RevealTeamClusterCredentialsOutputDTO
} from '@modules/cluster/application/dtos/RevealTeamClusterCredentialsDTO';
import { TeamClusterCredentialServicesDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import { requireOwnedTeamClusterWithSensitiveData } from '@modules/cluster/application/utilities/team-cluster-ownership';
import type { ITeamClusterCredentialsCipher } from '@modules/cluster/domain/port/ITeamClusterCredentialsCipher';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterCredentialsCipher from '@modules/cluster/infrastructure/services/TeamClusterCredentialsCipher';
import { assertConfirmedPassword } from '@modules/cluster/utilities/assertConfirmedPassword';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';

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
        
        private readonly teamClusterRepository: TeamClusterRepository,

        
        private readonly teamClusterCredentialsCipher: TeamClusterCredentialsCipher,

        
        private readonly userRepository: UserRepository,

        
        private readonly passwordHasher: BcryptPasswordHasher
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
