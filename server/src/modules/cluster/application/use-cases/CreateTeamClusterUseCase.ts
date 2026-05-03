import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import {
    CreateTeamClusterInputDTO,
    CreateTeamClusterOutputDTO
} from '@modules/cluster/application/dtos/CreateTeamClusterDTO';
import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import TeamCluster, {
    createDefaultTeamClusterRoleConfig,
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterCredentialsCipher from '@modules/cluster/infrastructure/services/TeamClusterCredentialsCipher';
import DemoClusterDeploymentService from '@modules/cluster/infrastructure/services/DemoClusterDeploymentService';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import crypto from 'node:crypto';
import { injectable } from 'tsyringe';

interface MongoDuplicateKeyError {
    code?: number;
}

interface GeneratedServiceCredentials {
    username: string;
    password: string;
}

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
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly teamClusterCredentialsCipher: TeamClusterCredentialsCipher,
        private readonly userRepository: UserRepository,
        private readonly demoClusterDeploymentService: DemoClusterDeploymentService,
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: CreateTeamClusterInputDTO): Promise<Result<CreateTeamClusterOutputDTO, ApplicationError>> {
        const user = await this.userRepository.findById(input.userId);
        if (!user) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::UserNotFound',
                'User not found'
            ));
        }

        const existingDemo = await this.teamClusterRepository.findActiveDemoByTeamId(input.teamId);

        const enrollmentToken = createEnrollmentToken();
        const minioCredentials = createServiceCredentials('minio');
        const redisCredentials = createServiceCredentials('redis');
        const mongodbCredentials = createServiceCredentials('mongodb');
        const daemonPassword = crypto.randomBytes(24).toString('hex');

        const [encryptedMinioUsername, encryptedMinioPassword, encryptedRedisUsername, encryptedRedisPassword, encryptedMongodbUsername, encryptedMongodbPassword, encryptedDaemonPassword] = await Promise.all([
            this.teamClusterCredentialsCipher.encrypt(minioCredentials.username),
            this.teamClusterCredentialsCipher.encrypt(minioCredentials.password),
            this.teamClusterCredentialsCipher.encrypt(redisCredentials.username),
            this.teamClusterCredentialsCipher.encrypt(redisCredentials.password),
            this.teamClusterCredentialsCipher.encrypt(mongodbCredentials.username),
            this.teamClusterCredentialsCipher.encrypt(mongodbCredentials.password),
            this.teamClusterCredentialsCipher.encrypt(daemonPassword)
        ]);

        const teamCluster = new TeamCluster('', {
            name: input.name.trim(),
            team: input.teamId,
            createdBy: input.userId,
            status: TeamClusterStatus.WaitingForConnection,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            installedVersion: null,
            installRoot: null,
            lastHeartbeatAt: null,
            lastDisconnectAt: null,
            services: {
                minio: {
                    port: null,
                    username: encryptedMinioUsername,
                    password: encryptedMinioPassword
                },
                redis: {
                    port: null,
                    username: encryptedRedisUsername,
                    password: encryptedRedisPassword
                },
                mongodb: {
                    port: null,
                    username: encryptedMongodbUsername,
                    password: encryptedMongodbPassword
                },
                daemon: {
                    port: null,
                    password: encryptedDaemonPassword
                }
            },
            queueConcurrency: DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
            queueScopeLimits: DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
            roleConfig: createDefaultTeamClusterRoleConfig(),
            isDemo: false,
            demoExpiresAt: null,
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

        logger.info(`Team cluster created teamClusterId=${createdTeamCluster._id} teamId=${input.teamId} userId=${input.userId}`);

        if (existingDemo) {
            void (async () => {
                try {
                    await this.teamClusterLifecycleService.markDeleting(existingDemo.id);
                } catch (error: unknown) {
                    logger.warn(`[CreateTeamClusterUseCase] markDeleting on existing demo failed teamClusterId=${existingDemo.id} error=${(error as Error).message}`);
                }
                try {
                    await this.demoClusterDeploymentService.teardownDemoStack(existingDemo);
                    const refreshed = await this.teamClusterRepository.findById(existingDemo.id);
                    if (refreshed) {
                        await this.teamClusterLifecycleService.deleteTeamCluster(refreshed);
                    }
                    logger.info(`[CreateTeamClusterUseCase] Auto-removed demo after real cluster creation teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
                } catch (error: unknown) {
                    logger.error(error, `[CreateTeamClusterUseCase] Auto-teardown of demo failed teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
                }
            })();
        }

        return Result.ok({
            teamCluster: toTeamClusterDTO(createdTeamCluster),
            enrollmentToken
        });
    }
}
