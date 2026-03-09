import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import {
    CreateTeamClusterInputDTO,
    CreateTeamClusterOutputDTO
} from '@modules/team-cluster/application/dtos/CreateTeamClusterDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import TeamCluster, { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterCredentialsCipher } from '@modules/team-cluster/domain/port/ITeamClusterCredentialsCipher';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/team-cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import crypto from 'node:crypto';

interface MongoDuplicateKeyError {
    code?: number;
};

interface GeneratedServiceCredentials {
    username: string;
    password: string;
};

const isMongoDuplicateKeyError = (error: unknown): error is MongoDuplicateKeyError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

const createServiceCredentials = (serviceName: string): GeneratedServiceCredentials => {
    const suffix = crypto.randomBytes(4).toString('hex');

    return {
        username: `volt_${serviceName}_${suffix}`,
        password: crypto.randomBytes(24).toString('hex')
    };
};

@injectable()
export default class CreateTeamClusterUseCase implements IUseCase<CreateTeamClusterInputDTO, CreateTeamClusterOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterCredentialsCipher)
        private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher,

        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: CreateTeamClusterInputDTO): Promise<Result<CreateTeamClusterOutputDTO, ApplicationError>> {
        const user = await this.userRepository.findById(input.userId);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::UserNotFound',
                'User not found'
            ));
        }

        const enrollmentToken = createEnrollmentToken();
        const minioCredentials = createServiceCredentials('minio');
        const redisCredentials = createServiceCredentials('redis');
        const mongodbCredentials = createServiceCredentials('mongodb');
        const daemonPassword = crypto.randomBytes(24).toString('hex');

        const teamCluster = new TeamCluster('', {
            name: input.name.trim(),
            team: input.teamId,
            createdBy: input.userId,
            status: TeamClusterStatus.WaitingForConnection,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            installedVersion: null,
            lastHeartbeatAt: null,
            lastDisconnectAt: null,
            services: {
                minio: {
                    port: null,
                    username: this.teamClusterCredentialsCipher.encrypt(minioCredentials.username),
                    password: this.teamClusterCredentialsCipher.encrypt(minioCredentials.password)
                },
                redis: {
                    port: null,
                    username: this.teamClusterCredentialsCipher.encrypt(redisCredentials.username),
                    password: this.teamClusterCredentialsCipher.encrypt(redisCredentials.password)
                },
                mongodb: {
                    port: null,
                    username: this.teamClusterCredentialsCipher.encrypt(mongodbCredentials.username),
                    password: this.teamClusterCredentialsCipher.encrypt(mongodbCredentials.password)
                },
                daemon: {
                    port: null,
                    password: this.teamClusterCredentialsCipher.encrypt(daemonPassword)
                }
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });

        let createdTeamCluster: TeamCluster;

        try {
            createdTeamCluster = await this.teamClusterRepository.create(teamCluster.props);
        } catch (error: unknown) {
            if (isMongoDuplicateKeyError(error) && error.code === 11000) {
                return Result.fail(ApplicationError.conflict(
                    'TeamCluster::AlreadyExists',
                    'A team cluster with this name already exists'
                ));
            }

            return Result.fail(ApplicationError.internalServerError('Failed to create team cluster'));
        }

        logger.info({
            action: 'team-cluster.create',
            teamClusterId: createdTeamCluster._id,
            teamId: input.teamId,
            userId: input.userId
        }, 'Team cluster created');

        return Result.ok({
            teamCluster: toTeamClusterDTO(createdTeamCluster),
            enrollmentToken
        });
    }
};
