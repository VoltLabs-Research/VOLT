import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import type { ITeamClusterCredentialsCipher } from '@modules/cluster/domain/port/ITeamClusterCredentialsCipher';
import type { IDemoClusterDeploymentService } from '@modules/cluster/domain/port/IDemoClusterDeploymentService';
import type { ITeamClusterLifecycleService } from '@modules/cluster/domain/port/ITeamClusterLifecycleService';
import {
    buildTeamClusterEntity,
    createDaemonPassword,
    createServiceCredentials,
    encryptTeamClusterServices
} from '@modules/cluster/application/utilities/team-cluster-builder';
import {
    CreateTeamClusterInputDTO,
    CreateTeamClusterOutputDTO
} from '@modules/cluster/application/dtos/CreateTeamClusterDTO';
import { toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import TeamCluster from '@modules/cluster/domain/entities/TeamCluster';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';

interface MongoDuplicateKeyError {
    code?: number;
}

const isMongoDuplicateKeyError = (error: unknown): error is MongoDuplicateKeyError => {
    return typeof error === 'object' && error !== null && 'code' in error;
};

@injectable()
export default class CreateTeamClusterUseCase implements IUseCase<CreateTeamClusterInputDTO, CreateTeamClusterOutputDTO, ApplicationError> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(CLUSTER_TOKENS.TeamClusterCredentialsCipher) private readonly teamClusterCredentialsCipher: ITeamClusterCredentialsCipher,
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(CLUSTER_TOKENS.DemoClusterDeploymentService) private readonly demoClusterDeploymentService: IDemoClusterDeploymentService,
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService
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
        const encryptedServices = await encryptTeamClusterServices(this.teamClusterCredentialsCipher, {
            minio: createServiceCredentials('minio'),
            redis: createServiceCredentials('redis'),
            mongodb: createServiceCredentials('mongodb'),
            daemon: {
                password: createDaemonPassword()
            }
        });

        const teamCluster = buildTeamClusterEntity({
            name: input.name.trim(),
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: encryptedServices,
            isDemo: false,
            demoExpiresAt: null
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
