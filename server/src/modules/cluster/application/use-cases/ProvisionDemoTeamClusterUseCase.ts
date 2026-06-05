import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { ITeamClusterCredentialsCipher } from '@modules/cluster/domain/port/ITeamClusterCredentialsCipher';
import type { IDemoClusterDeploymentService, DemoClusterPlaintextCredentials } from '@modules/cluster/domain/port/IDemoClusterDeploymentService';
import {
    buildTeamClusterEntity,
    createDaemonPassword,
    createServiceCredentials,
    encryptTeamClusterServices
} from '@modules/cluster/application/utilities/team-cluster-builder';
import {
    ProvisionDemoTeamClusterInputDTO,
    ProvisionDemoTeamClusterOutputDTO
} from '@modules/cluster/application/dtos/DemoTeamClusterDTO';
import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import TeamCluster from '@modules/cluster/domain/entities/TeamCluster';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';

const DEMO_CLUSTER_TTL_MINUTES = readNumberEnv('DEMO_CLUSTER_TTL_MINUTES', 30);

const buildPlaintextCredentials = (enrollmentToken: string): DemoClusterPlaintextCredentials => {
    const minio = createServiceCredentials('minio');
    const redis = createServiceCredentials('redis');
    const mongodb = createServiceCredentials('mongodb');

    return {
        enrollmentToken,
        minioUsername: minio.username,
        minioPassword: minio.password,
        redisUsername: redis.username,
        redisPassword: redis.password,
        mongodbUsername: mongodb.username,
        mongodbPassword: mongodb.password,
        daemonPassword: createDaemonPassword()
    };
};

@injectable()
export default class ProvisionDemoTeamClusterUseCase implements IUseCase<ProvisionDemoTeamClusterInputDTO, ProvisionDemoTeamClusterOutputDTO, ApplicationError> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterCredentialsCipher) private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher,
        @inject(CLUSTER_TOKENS.DemoClusterDeploymentService) private readonly demoClusterDeploymentService: IDemoClusterDeploymentService
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
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEMO_CLUSTER_TTL_MINUTES * 60_000);
        const encryptedServices = await encryptTeamClusterServices(this.teamClusterCredentialsCipher, {
            minio: {
                username: credentials.minioUsername,
                password: credentials.minioPassword
            },
            redis: {
                username: credentials.redisUsername,
                password: credentials.redisPassword
            },
            mongodb: {
                username: credentials.mongodbUsername,
                password: credentials.mongodbPassword
            },
            daemon: {
                password: credentials.daemonPassword
            }
        });

        const teamCluster = buildTeamClusterEntity({
            name: `Demo Cluster ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: encryptedServices,
            isDemo: true,
            demoExpiresAt: expiresAt,
            now
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
