import {
    ProvisionDemoTeamClusterInputDTO,
    ProvisionDemoTeamClusterOutputDTO
} from '@modules/cluster/application/dtos/DemoTeamClusterDTO';
import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import TeamCluster, {
    createDefaultTeamClusterRoleConfig,
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterCredentialsCipher from '@modules/cluster/infrastructure/services/TeamClusterCredentialsCipher';
import DemoClusterDeploymentService, {
    DemoClusterPlaintextCredentials
} from '@modules/cluster/infrastructure/services/DemoClusterDeploymentService';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import crypto from 'node:crypto';
import { injectable } from 'tsyringe';

const DEMO_CLUSTER_TTL_MINUTES = readNumberEnv('DEMO_CLUSTER_TTL_MINUTES', 30);

const buildPlaintextCredentials = (enrollmentToken: string): DemoClusterPlaintextCredentials => {
    const suffix = (): string => crypto.randomBytes(4).toString('hex');
    const password = (): string => crypto.randomBytes(24).toString('hex');

    return {
        enrollmentToken,
        minioUsername: `volt_minio_${suffix()}`,
        minioPassword: password(),
        redisUsername: `volt_redis_${suffix()}`,
        redisPassword: password(),
        mongodbUsername: `volt_mongodb_${suffix()}`,
        mongodbPassword: password(),
        daemonPassword: password()
    };
};

@injectable()
export default class ProvisionDemoTeamClusterUseCase implements IUseCase<ProvisionDemoTeamClusterInputDTO, ProvisionDemoTeamClusterOutputDTO, ApplicationError> {
    constructor(
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly teamClusterCredentialsCipher: TeamClusterCredentialsCipher,
        private readonly demoClusterDeploymentService: DemoClusterDeploymentService
    ){}

    async execute(input: ProvisionDemoTeamClusterInputDTO): Promise<Result<ProvisionDemoTeamClusterOutputDTO, ApplicationError>> {
        const existingDemo = await this.teamClusterRepository.findActiveDemoByTeamId(input.teamId);
        if (existingDemo) {
            logger.info(`[ProvisionDemoTeamClusterUseCase] Returning existing demo teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
            return Result.ok({
                teamCluster: toTeamClusterDTO(existingDemo)
            });
        }

        const enrollmentToken = createEnrollmentToken();
        const credentials = buildPlaintextCredentials(enrollmentToken);

        const [
            encryptedMinioUsername,
            encryptedMinioPassword,
            encryptedRedisUsername,
            encryptedRedisPassword,
            encryptedMongodbUsername,
            encryptedMongodbPassword,
            encryptedDaemonPassword
        ] = await Promise.all([
            this.teamClusterCredentialsCipher.encrypt(credentials.minioUsername),
            this.teamClusterCredentialsCipher.encrypt(credentials.minioPassword),
            this.teamClusterCredentialsCipher.encrypt(credentials.redisUsername),
            this.teamClusterCredentialsCipher.encrypt(credentials.redisPassword),
            this.teamClusterCredentialsCipher.encrypt(credentials.mongodbUsername),
            this.teamClusterCredentialsCipher.encrypt(credentials.mongodbPassword),
            this.teamClusterCredentialsCipher.encrypt(credentials.daemonPassword)
        ]);

        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEMO_CLUSTER_TTL_MINUTES * 60_000);

        const teamCluster = new TeamCluster('', {
            name: `Demo Cluster ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
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
            isDemo: true,
            demoExpiresAt: expiresAt,
            createdAt: now,
            updatedAt: now
        });

        let createdTeamCluster: TeamCluster;
        try {
            createdTeamCluster = await this.teamClusterRepository.create(teamCluster.props);
        } catch (error: unknown) {
            const code = (error as { code?: number }).code;
            if (code === 11000) {
                const fallback = await this.teamClusterRepository.findActiveDemoByTeamId(input.teamId);
                if (fallback) {
                    return Result.ok({
                        teamCluster: toTeamClusterDTO(fallback)
                    });
                }
            }
            logger.error(error, `[ProvisionDemoTeamClusterUseCase] Failed to persist demo cluster teamId=${input.teamId}`);
            return Result.fail(ApplicationError.internalServerError('Failed to provision demo cluster'));
        }

        logger.info(`[ProvisionDemoTeamClusterUseCase] Demo cluster persisted teamClusterId=${createdTeamCluster.id} teamId=${input.teamId} expiresAt=${expiresAt.toISOString()}`);

        void this.demoClusterDeploymentService.deployDemoStack(createdTeamCluster, credentials).catch((error: unknown) => {
            logger.error(error, `[ProvisionDemoTeamClusterUseCase] Demo stack deploy failed teamClusterId=${createdTeamCluster.id} teamId=${input.teamId}`);
        });

        return Result.ok({
            teamCluster: toTeamClusterDTO(createdTeamCluster)
        });
    }
}
