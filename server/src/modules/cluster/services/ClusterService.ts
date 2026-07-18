import { ErrorCodes } from '@core/constants/error-codes';
import { AUTH_CONTRACT_TOKENS } from '@shared/contracts/tokens/AuthTokens';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import type { IPasswordHasher } from '@modules/auth/ports/IPasswordHasher';
import { SYSTEM_CONTRACT_TOKENS } from '@shared/contracts/tokens/SystemTokens';
import type { ISystemMetricsRepository } from '@modules/system/ports/ISystemMetricsRepository';
import type { SystemStatus } from '@modules/system/value-objects/SystemMetrics';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type {
    ISceneArtifactRepository,
    ITrajectoryRepository,
    IAnalysisRepository
} from '@shared/contracts/ports';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId,
    resolveTrajectoryStorageClusterId
} from '@shared/application/utilities/cluster-location';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { TeamClusterDaemonSemanticCommandResult } from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { GenericDomainEvent } from '@shared/domain/events/GenericDomainEvent';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import type { SceneArtifactBatchUpsertedArtifact } from '@shared/contracts/events';
import { JobStatus } from '@shared/contracts/types';
import type {
    AnalysisStageStatus,
    AnalysisStageType,
    AnalysisExpectedArtifact,
    SceneArtifactParams,
    SceneArtifactSourceType,
    SceneArtifactStatus
} from '@shared/contracts/types';
import {
    ChannelCommands,
    type TeamClusterDaemonQueueConcurrencyApplyPayload,
    type TeamClusterDaemonRoleApplyPayload,
    type TeamClusterDaemonRoleApplyResult
} from '@shared/infrastructure/contracts/team-cluster';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';
import { container as diContainer } from 'tsyringe';
import type { Readable } from 'node:stream';
import type { HydratedDocument } from 'mongoose';

import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import TeamClusterModel, { TeamClusterDocument } from '@modules/cluster/models/TeamClusterModel';
import ClusterTransferJobModel, { ClusterTransferJobDocument } from '@modules/cluster/models/ClusterTransferJobModel';
import teamClusterMapper from '@modules/cluster/mappers/TeamClusterMapper';
import TeamCluster, {
    TeamClusterStatus,
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    resolveEffectiveCapabilitiesFromRoleConfig
} from '@modules/cluster/entities/TeamCluster';
import type {
    TeamClusterRole,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps
} from '@modules/cluster/entities/TeamCluster';
import type ClusterTransferJob from '@modules/cluster/entities/ClusterTransferJob';
import type { ClusterTransferJobState } from '@modules/cluster/entities/ClusterTransferJob';
import type StoragePlacement from '@modules/cluster/entities/StoragePlacement';

import type {
    TeamClusterDTO,
    TeamClusterQueueConcurrencyDTO,
    TeamClusterQueueScopeLimitsDTO,
    TeamClusterCredentialServicesDTO
} from '@modules/cluster/contracts/TeamClusterView';
import type { ClusterTransferJobDTO } from '@modules/cluster/contracts/ClusterTransferJobView';
import {
    TeamClusterRemoteAccessTargetDTO,
    type TeamClusterRemoteAccessSessionDTO,
    type TeamClusterRemoteExplorerEntryDTO,
    type TeamClusterRemoteExplorerNodeDTO
} from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import type {
    TeamClusterInstallManifestDTO,
    TeamClusterInstallManifestPortsDTO
} from '@modules/cluster/contracts/TeamClusterInstallManifest';
import type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/contracts/TeamClusterHeartbeat';

import ClusterTransferCoordinator from '@modules/cluster/services/ClusterTransferCoordinator';
import StoragePlacementService from '@modules/cluster/services/StoragePlacementService';
import type ClusterTransferRunner from '@modules/cluster/services/ClusterTransferRunner';
import type TeamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import type DemoClusterDeploymentService from '@modules/cluster/services/DemoClusterDeploymentService';
import type { DemoClusterPlaintextCredentials } from '@modules/cluster/services/DemoClusterDeploymentService';
import type TeamClusterCredentialsCipher from '@modules/cluster/services/TeamClusterCredentialsCipher';
import type TeamClusterInstallManifestService from '@modules/cluster/services/TeamClusterInstallManifestService';
import type TeamClusterRemoteAccessSessionService from '@modules/cluster/services/TeamClusterRemoteAccessSessionService';
import type RemoteExplorerDaemonGateway from '@modules/cluster/services/RemoteExplorerDaemonGateway';
import type DaemonAnalysisCompletionService from '@modules/cluster/services/DaemonAnalysisCompletionService';

import {
    createEnrollmentToken,
    hashEnrollmentToken
} from '@modules/cluster/utilities/enrollmentToken';
import {
    buildTeamClusterEntity,
    createServiceCredentials,
    createDaemonPassword,
    encryptTeamClusterServices
} from '@modules/cluster/utilities/team-cluster-builder';
import { buildManualTeamClusterUninstallCommand } from '@modules/cluster/utilities/installRoot';
import { assertConfirmedPassword } from '@modules/cluster/utilities/assertConfirmedPassword';

import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';

const SENSITIVE_FIELDS_SELECTION = [
    '+enrollmentTokenHash',
    '+services.minio.username',
    '+services.minio.password',
    '+services.redis.username',
    '+services.redis.password',
    '+services.mongodb.username',
    '+services.mongodb.password',
    '+services.daemon.password'
].join(' ');

const MB_PER_GB = 1024;
const DEMO_CLUSTER_TTL_MINUTES = readNumberEnv('DEMO_CLUSTER_TTL_MINUTES', 30);

const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobState[] = [
    'queued',
    'freezing',
    'copying',
    'verifying',
    'switching',
    'cleaning'
];

const WAITING_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.WaitingForConnection,
    TeamClusterStatus.HealthcheckReceived,
    TeamClusterStatus.PreparingEnvironment,
    TeamClusterStatus.Disconnected
]);

interface ActiveDemoQuery {
    team: string;
    isDemo: true;
    status: { $nin: TeamClusterStatus[] };
}

const activeDemoFilter = (teamId: string): ActiveDemoQuery => ({
    team: teamId,
    isDemo: true,
    status: { $nin: [TeamClusterStatus.Deleting, TeamClusterStatus.DeleteFailed] }
});

interface DaemonQueueSnapshotEntry {
    name: string;
    counts: {
        waiting: number;
        active: number;
        delayed: number;
        completed: number;
        failed: number;
    };
}

interface ServerQueueSnapshotEntry {
    name: string;
    location: 'server';
    concurrency: number;
}

interface ClusterResourceLimitsDTO {
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: SystemStatus | null;
    lastUpdatedAt: string | null;
}

// ---- Daemon job-completion payload shapes (folded from ProcessDaemonJobCompletionUseCase) --

type RasterJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type GlbJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type ArtifactUploadJobStatus = JobStatus.Queued | JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

interface ProcessDaemonAnalysisJobCompletionInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    success: boolean;
    error?: string;
}

interface ProcessDaemonAnalysisJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ProcessDaemonAnalysisStageStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    timestep?: number;
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
    stageStatus: AnalysisStageStatus;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
}

interface ProcessDaemonRasterJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonRasterJobStatusInputDTO extends ProcessDaemonRasterJobStatusInputDTO {
    status: RasterJobStatus;
}

interface ProcessDaemonGlbJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonGlbJobStatusInputDTO extends ProcessDaemonGlbJobStatusInputDTO {
    status: GlbJobStatus;
}

interface ProcessDaemonArtifactUploadJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonArtifactUploadJobStatusInputDTO extends ProcessDaemonArtifactUploadJobStatusInputDTO {
    status: ArtifactUploadJobStatus;
}

export type ProcessDaemonJobCompletionInputDTO =
    | ProcessDaemonAnalysisJobCompletionInputDTO
    | ProcessDaemonAnalysisJobStatusInputDTO
    | ProcessDaemonAnalysisStageStatusInputDTO
    | ProcessDaemonRasterJobStatusInputDTO
    | ProcessDaemonGlbJobStatusInputDTO
    | ProcessDaemonArtifactUploadJobStatusInputDTO;

interface ProcessDaemonJobCompletionOutputDTO {
    acknowledged: boolean;
}

// ---- Daemon scene-artifact-upsert payload shapes (folded from ProcessDaemonSceneArtifactUpsertUseCase) --

export interface ProcessDaemonSceneArtifactUpsertInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: SceneArtifactSourceType;
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: SceneArtifactParams;
    displayName: string;
    status: SceneArtifactStatus;
    metadata?: Record<string, unknown>;
}

interface ProcessDaemonSceneArtifactUpsertOutputDTO {
    acknowledged: boolean;
}

interface PreparedSceneArtifactUpsertEntry {
    objectName: string;
    teamId: string;
    data: {
        trajectory: string;
        storageClusterId: string;
        analysis?: string;
        plugin?: string;
        sourceType: SceneArtifactSourceType;
        timestep: number;
        params: SceneArtifactParams;
        displayName: string;
        status: SceneArtifactStatus;
        storageBucket: string;
        metadata?: Record<string, unknown>;
    };
}

/**
 * The single application service for the cluster module (pollium style: holds
 * ALL the team-cluster HTTP + daemon domain logic, `new`s the stateless
 * collaborators it needs, and talks to the Mongoose {@link TeamClusterModel} /
 * {@link ClusterTransferJobModel} directly — no use case or repository on the
 * service itself). Throws typed {@link ApplicationError}s (no Result channel)
 * so Express forwards them to the global error middleware.
 *
 * Genuinely-stateful orchestration collaborators (lifecycle service, demo
 * deployment, transfer coordinator/runner, credentials cipher, install
 * manifest, remote-access session, remote-explorer daemon gateway, daemon
 * analysis completion) stay in their own `@Singleton` classes (unchanged) and
 * are resolved once per `ClusterService` instance — via their registered
 * token (typed as the concrete class, not an interface) when they are
 * registered under a distinct `Symbol` token, or by class reference when they
 * self-register (bare `@Singleton()`) — so the exact same shared instance used
 * by the socket module / lifecycle sweep is reused here, never a fresh one.
 */
export default class ClusterService {
    // Cross-module collaborators resolved via their neutral token.
    #userRepository = diContainer.resolve<IUserRepository>(AUTH_CONTRACT_TOKENS.UserRepository);
    #passwordHasher = diContainer.resolve<IPasswordHasher>(AUTH_CONTRACT_TOKENS.PasswordHasher);
    #systemMetricsRepository = diContainer.resolve<ISystemMetricsRepository>(SYSTEM_CONTRACT_TOKENS.SystemMetricsRepository);
    #teamClusterDaemonClient = diContainer.resolve<ITeamClusterDaemonClient>(SHARED_TOKENS.TeamClusterDaemonClient);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    #analysisRepository = diContainer.resolve<IAnalysisRepository>(COMPUTE_TOKENS.AnalysisRepository);
    #trajectoryRepository = diContainer.resolve<ITrajectoryRepository>(COMPUTE_TOKENS.TrajectoryRepository);
    #sceneArtifactRepository = diContainer.resolve<ISceneArtifactRepository>(COMPUTE_TOKENS.SceneArtifactRepository);

    // Cluster-owned stateful singletons — resolved by their registered token
    // (typed as the concrete class) so the shared instance is reused, or by
    // class reference where the class self-registers under a bare `@Singleton()`.
    #lifecycleService = diContainer.resolve<TeamClusterLifecycleService>(CLUSTER_TOKENS.TeamClusterLifecycleService);
    #demoDeploymentService = diContainer.resolve<DemoClusterDeploymentService>(CLUSTER_TOKENS.DemoClusterDeploymentService);
    #credentialsCipher = diContainer.resolve<TeamClusterCredentialsCipher>(CLUSTER_TOKENS.TeamClusterCredentialsCipher);
    #installManifestService = diContainer.resolve<TeamClusterInstallManifestService>(CLUSTER_TOKENS.TeamClusterInstallManifestService);
    #remoteAccessSessionService = diContainer.resolve<TeamClusterRemoteAccessSessionService>(CLUSTER_TOKENS.TeamClusterRemoteAccessSessionService);
    #remoteExplorerDaemonGateway = diContainer.resolve<RemoteExplorerDaemonGateway>(CLUSTER_TOKENS.RemoteExplorerDaemonGateway);
    #daemonAnalysisCompletionService = diContainer.resolve<DaemonAnalysisCompletionService>(CLUSTER_TOKENS.DaemonAnalysisCompletionService);
    #transferRunner = diContainer.resolve<ClusterTransferRunner>(CLUSTER_TOKENS.ClusterTransferRunner);
    #transferCoordinator = diContainer.resolve(ClusterTransferCoordinator);
    #storagePlacementService = diContainer.resolve(StoragePlacementService);

    // ---- Team clusters --------------------------------------------------

    async create(input: { teamId: string; userId: string; name: string }): Promise<{ teamCluster: TeamClusterDTO; enrollmentToken: string }> {
        const user = await this.#userRepository.findById(input.userId);
        if (!user) {
            throw ApplicationError.notFound('TeamCluster::UserNotFound', 'User not found');
        }

        const existingDemo = await TeamClusterModel.findOne(activeDemoFilter(input.teamId));

        const enrollmentToken = createEnrollmentToken();
        const encryptedServices = await encryptTeamClusterServices(this.#credentialsCipher, {
            minio: createServiceCredentials('minio'),
            redis: createServiceCredentials('redis'),
            mongodb: createServiceCredentials('mongodb'),
            daemon: {
                password: createDaemonPassword()
            }
        });

        const teamClusterProps = buildTeamClusterEntity({
            name: input.name.trim(),
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: encryptedServices,
            isDemo: false,
            demoExpiresAt: null
        }).props;

        let created: HydratedDocument<TeamClusterDocument>;
        try {
            created = await TeamClusterModel.create(teamClusterProps);
        } catch (error: unknown) {
            if (this.#isMongoDuplicateKeyError(error) && error.code === 11000) {
                throw ApplicationError.conflict('TeamCluster::AlreadyExists', 'A team cluster with this name already exists');
            }
            throw ApplicationError.internalServerError('Failed to create team cluster');
        }

        logger.info(`Team cluster created teamClusterId=${created._id} teamId=${input.teamId} userId=${input.userId}`);

        if (existingDemo) {
            void (async () => {
                try {
                    await this.#lifecycleService.markDeleting(String(existingDemo._id));
                } catch (error: unknown) {
                    logger.warn(`[ClusterService.create] markDeleting on existing demo failed teamClusterId=${existingDemo._id} error=${(error as Error).message}`);
                }
                try {
                    await this.#demoDeploymentService.teardownDemoStack(teamClusterMapper.toDomain(existingDemo));
                    const refreshed = await TeamClusterModel.findById(existingDemo._id);
                    if (refreshed) {
                        await this.#lifecycleService.deleteTeamCluster(teamClusterMapper.toDomain(refreshed));
                    }
                    logger.info(`[ClusterService.create] Auto-removed demo after real cluster creation teamClusterId=${existingDemo._id} teamId=${input.teamId}`);
                } catch (error: unknown) {
                    logger.error(error, `[ClusterService.create] Auto-teardown of demo failed teamClusterId=${existingDemo._id} teamId=${input.teamId}`);
                }
            })();
        }

        return {
            teamCluster: this.#presentTeamCluster(created),
            enrollmentToken
        };
    }

    async listByTeamId(input: { teamId: string; page?: number; limit?: number; search?: string }): Promise<PaginatedResult<TeamClusterDTO>> {
        const filter: Record<string, unknown> = { team: input.teamId };

        const search = input.search?.trim();
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { installedVersion: { $regex: search, $options: 'i' } },
                { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: search, options: 'i' } } }
            ];
        }

        const page = input.page ?? 1;
        const limit = input.limit ?? 100;

        const [docs, total] = await Promise.all([
            TeamClusterModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
            TeamClusterModel.countDocuments(filter)
        ]);

        const clusterIds = docs.map((doc) => String(doc._id));
        const clusterIdSet = new Set(clusterIds);
        const activeTransfersByClusterId = new Map<string, ClusterTransferJobDTO[]>();
        const normalizedClusterIds = [...new Set(clusterIds.filter(Boolean))];

        if (normalizedClusterIds.length > 0) {
            const activeTransferJobs = await ClusterTransferJobModel.find({
                team: input.teamId,
                state: { $in: OPEN_TRANSFER_JOB_STATES },
                $or: [
                    { sourceClusterId: { $in: normalizedClusterIds } },
                    { destinationClusterId: { $in: normalizedClusterIds } }
                ]
            }).sort({ updatedAt: -1, createdAt: -1 }).exec();

            for (const job of activeTransferJobs) {
                const jobDTO = this.#presentClusterTransferJob(job);

                if (clusterIdSet.has(job.sourceClusterId)) {
                    const sourceJobs = activeTransfersByClusterId.get(job.sourceClusterId) ?? [];
                    sourceJobs.push(jobDTO);
                    activeTransfersByClusterId.set(job.sourceClusterId, sourceJobs);
                }

                if (job.destinationClusterId !== job.sourceClusterId && clusterIdSet.has(job.destinationClusterId)) {
                    const destinationJobs = activeTransfersByClusterId.get(job.destinationClusterId) ?? [];
                    destinationJobs.push(jobDTO);
                    activeTransfersByClusterId.set(job.destinationClusterId, destinationJobs);
                }
            }
        }

        return {
            data: docs.map((doc) => this.#presentTeamCluster(doc, {
                activeTransfers: activeTransfersByClusterId.get(String(doc._id)) ?? []
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async provisionDemo(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterDTO }> {
        const existingDemo = await TeamClusterModel.findOne(activeDemoFilter(input.teamId));
        if (existingDemo) {
            logger.info(`[ClusterService.provisionDemo] Returning existing demo teamClusterId=${existingDemo._id} teamId=${input.teamId}`);
            return { teamCluster: this.#presentTeamCluster(existingDemo) };
        }

        const enrollmentToken = createEnrollmentToken();
        const credentials = this.#buildDemoPlaintextCredentials(enrollmentToken);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEMO_CLUSTER_TTL_MINUTES * 60_000);
        const encryptedServices = await encryptTeamClusterServices(this.#credentialsCipher, {
            minio: { username: credentials.minioUsername, password: credentials.minioPassword },
            redis: { username: credentials.redisUsername, password: credentials.redisPassword },
            mongodb: { username: credentials.mongodbUsername, password: credentials.mongodbPassword },
            daemon: { password: credentials.daemonPassword }
        });

        const teamClusterProps = buildTeamClusterEntity({
            name: `Demo Cluster ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: encryptedServices,
            isDemo: true,
            demoExpiresAt: expiresAt,
            now
        }).props;

        let created: HydratedDocument<TeamClusterDocument>;
        try {
            created = await TeamClusterModel.create(teamClusterProps);
        } catch (error: unknown) {
            const code = (error as { code?: number }).code;
            if (code === 11000) {
                const fallback = await TeamClusterModel.findOne(activeDemoFilter(input.teamId));
                if (fallback) {
                    return { teamCluster: this.#presentTeamCluster(fallback) };
                }
            }
            logger.error(error, `[ClusterService.provisionDemo] Failed to persist demo cluster teamId=${input.teamId}`);
            throw ApplicationError.internalServerError('Failed to provision demo cluster');
        }

        logger.info(`[ClusterService.provisionDemo] Demo cluster persisted teamClusterId=${created._id} teamId=${input.teamId} expiresAt=${expiresAt.toISOString()}`);

        void this.#demoDeploymentService.deployDemoStack(teamClusterMapper.toDomain(created), credentials).catch((error: unknown) => {
            logger.error(error, `[ClusterService.provisionDemo] Demo stack deploy failed teamClusterId=${created._id} teamId=${input.teamId}`);
        });

        return { teamCluster: this.#presentTeamCluster(created) };
    }

    async deleteDemo(input: { teamId: string; userId: string }): Promise<{ teardownScheduled: boolean }> {
        const demo = await TeamClusterModel.findOne(activeDemoFilter(input.teamId));
        if (!demo) {
            return { teardownScheduled: false };
        }

        try {
            await this.#lifecycleService.markDeleting(String(demo._id));
        } catch (error: unknown) {
            logger.warn(`[ClusterService.deleteDemo] markDeleting failed teamClusterId=${demo._id} error=${(error as Error).message}`);
        }

        const refreshed = await TeamClusterModel.findById(demo._id);
        const target = refreshed ?? demo;

        void (async () => {
            try {
                await this.#demoDeploymentService.teardownDemoStack(teamClusterMapper.toDomain(target));
                await this.#lifecycleService.deleteTeamCluster(teamClusterMapper.toDomain(target));
                logger.info(`[ClusterService.deleteDemo] Demo deleted teamClusterId=${target._id} teamId=${input.teamId}`);
            } catch (error: unknown) {
                logger.error(error, `[ClusterService.deleteDemo] Demo teardown failed teamClusterId=${target._id} teamId=${input.teamId}`);
            }
        })();

        return { teardownScheduled: true };
    }

    async getDemoStatus(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterDTO | null; remainingMs: number | null; hasActiveDemo: boolean }> {
        const demo = await TeamClusterModel.findOne(activeDemoFilter(input.teamId));
        if (!demo) {
            return { teamCluster: null, remainingMs: null, hasActiveDemo: false };
        }

        const expiresAt = demo.demoExpiresAt;
        if (!expiresAt) {
            return { teamCluster: this.#presentTeamCluster(demo), remainingMs: null, hasActiveDemo: true };
        }

        const now = Date.now();
        const remainingMs = expiresAt.getTime() - now;

        if (remainingMs <= 0) {
            void this.#scheduleExpiredDemoCleanup(String(demo._id), input.teamId);
            return { teamCluster: this.#presentTeamCluster(demo), remainingMs: 0, hasActiveDemo: false };
        }

        return { teamCluster: this.#presentTeamCluster(demo), remainingMs, hasActiveDemo: true };
    }

    async getById(input: { teamId: string; teamClusterId: string }): Promise<{ teamCluster: TeamClusterDTO }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);
        return { teamCluster: this.#presentTeamCluster(doc) };
    }

    async getRuntimeSnapshot(input: { teamId: string; teamClusterId: string }): Promise<{
        capturedAt: string;
        queueConcurrency: TeamClusterQueueConcurrencyDTO;
        daemonQueues: DaemonQueueSnapshotEntry[];
        serverQueues: ServerQueueSnapshotEntry[];
    }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        let daemonQueues: DaemonQueueSnapshotEntry[] = [];
        let capturedAt = new Date().toISOString();

        if (doc.status === TeamClusterStatus.Connected) {
            try {
                const response = await this.#teamClusterDaemonClient.command<{ accepted?: boolean; queues?: DaemonQueueSnapshotEntry[]; capturedAt?: string }>(
                    String(doc._id),
                    ChannelCommands.RuntimeQueuesSnapshot,
                    {},
                    { timeoutClass: 'default' }
                );
                daemonQueues = response.queues ?? [];
                capturedAt = response.capturedAt ?? capturedAt;
            } catch (error: unknown) {
                logger.warn(error, `[ClusterService.getRuntimeSnapshot] daemon snapshot failed teamClusterId=${doc._id}`);
            }
        }

        return {
            capturedAt,
            queueConcurrency: this.#presentQueueConcurrency(doc.queueConcurrency),
            daemonQueues,
            serverQueues: []
        };
    }

    async updateQueueConcurrency(input: {
        teamId: string;
        teamClusterId: string;
        queueConcurrency: TeamClusterQueueConcurrencyProps;
        queueScopeLimits: TeamClusterQueueScopeLimitsProps;
    }): Promise<{ message: string; teamCluster: TeamClusterDTO }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const persistedQueueConcurrency = {
            ...DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
            ...doc.queueConcurrency,
            ...input.queueConcurrency
        };
        const persistedQueueScopeLimits = input.queueScopeLimits;

        const updated = await TeamClusterModel.findByIdAndUpdate(
            doc._id,
            { $set: { queueConcurrency: persistedQueueConcurrency, queueScopeLimits: persistedQueueScopeLimits } },
            { new: true }
        );
        if (!updated) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        this.#lifecycleService.publishTeamClusterUpdate(teamClusterMapper.toDomain(updated));

        if (updated.status === TeamClusterStatus.Connected) {
            try {
                const queueConcurrencyPayload: TeamClusterDaemonQueueConcurrencyApplyPayload = {
                    queueConcurrency: this.#presentQueueConcurrency(updated.queueConcurrency),
                    queueScopeLimits: this.#presentQueueScopeLimits(updated.queueScopeLimits)
                };
                const queueConcurrencyCommandResult = await this.#teamClusterDaemonClient.commandWithSemanticResult<{ accepted?: boolean; reason?: string }>(
                    String(updated._id),
                    ChannelCommands.RuntimeQueueConcurrencyApply,
                    queueConcurrencyPayload,
                    { timeoutClass: 'long-running-control-plane', retryClass: 'idempotent-command' }
                );

                if (!queueConcurrencyCommandResult.accepted) {
                    logger.warn(`Persisted team cluster queue concurrency but the daemon rejected the live apply request teamClusterId=${updated._id} teamId=${input.teamId} reason=${queueConcurrencyCommandResult.reason} queueConcurrency=${queueConcurrencyPayload.queueConcurrency}`);
                }
            } catch {
                logger.warn(`Persisted team cluster queue concurrency but failed to request live daemon apply teamClusterId=${updated._id} teamId=${input.teamId} queueConcurrency=${updated.queueConcurrency}`);
            }
        }

        return { message: 'Queue settings saved.', teamCluster: this.#presentTeamCluster(updated) };
    }

    async updateRole(input: { teamId: string; userId: string; teamClusterId: string; role: TeamClusterRole }): Promise<{ message: string; teamCluster: TeamClusterDTO }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const currentRoleConfig = doc.roleConfig;
        const nextRoleConfig = {
            ...currentRoleConfig,
            desiredRole: input.role,
            runtimeVersion: currentRoleConfig.desiredRole === input.role
                ? currentRoleConfig.runtimeVersion
                : currentRoleConfig.runtimeVersion + 1
        };

        let updated = await TeamClusterModel.findByIdAndUpdate(doc._id, { $set: { roleConfig: nextRoleConfig } }, { new: true });
        if (!updated) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        this.#lifecycleService.publishTeamClusterUpdate(teamClusterMapper.toDomain(updated));

        if (updated.status === TeamClusterStatus.Connected) {
            try {
                const rolePayload: TeamClusterDaemonRoleApplyPayload = { roleConfig: updated.roleConfig };
                const liveApplyResult = await this.#teamClusterDaemonClient.commandWithSemanticResult<TeamClusterDaemonRoleApplyResult>(
                    String(updated._id),
                    ChannelCommands.RuntimeRoleApply,
                    rolePayload,
                    { timeoutClass: 'long-running-control-plane', retryClass: 'idempotent-command' }
                );

                if (liveApplyResult.accepted) {
                    const roleResult = liveApplyResult.data;
                    const reUpdated = await TeamClusterModel.findByIdAndUpdate(updated._id, { $set: { roleConfig: roleResult.roleConfig } }, { new: true });
                    updated = reUpdated ?? updated;
                    this.#lifecycleService.publishTeamClusterUpdate(teamClusterMapper.toDomain(updated));
                } else {
                    logger.warn(`Persisted desired role but the daemon rejected the live apply request teamClusterId=${updated._id} teamId=${input.teamId} role=${input.role} reason=${liveApplyResult.reason}`);
                }
            } catch {
                logger.warn(`Persisted desired role but failed to request live daemon role apply teamClusterId=${updated._id} teamId=${input.teamId} role=${input.role}`);
            }
        }

        return { message: 'Team cluster role saved.', teamCluster: this.#presentTeamCluster(updated) };
    }

    async listTransferJobs(input: { teamId: string; teamClusterId: string; page?: number; limit?: number; state?: ClusterTransferJobState }): Promise<PaginatedResult<ClusterTransferJobDTO>> {
        const teamCluster = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const filter: Record<string, unknown> = {
            team: input.teamId,
            $or: [
                { sourceClusterId: String(teamCluster._id) },
                { destinationClusterId: String(teamCluster._id) }
            ]
        };
        if (input.state) {
            filter.state = input.state;
        }

        const page = input.page ?? 1;
        const limit = input.limit ?? 100;

        const [docs, total] = await Promise.all([
            ClusterTransferJobModel.find(filter).sort({ createdAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
            ClusterTransferJobModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#presentClusterTransferJob(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async createTransferRequest(input: { teamId: string; teamClusterId: string; destinationClusterId: string; authenticatedUserId: string }): Promise<{
        message: string;
        sourceClusterId: string;
        destinationClusterId: string;
        requestedJobs: ClusterTransferJobDTO[];
    }> {
        const sourceCluster = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);
        const destinationCluster = await this.#getOwnedTeamCluster(input.destinationClusterId, input.teamId);

        if (String(sourceCluster._id) === String(destinationCluster._id)) {
            throw ApplicationError.conflict('ClusterTransfer::DestinationMustDiffer', 'Destination cluster must be different from the source cluster');
        }

        const sourceCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(sourceCluster.roleConfig);
        if (sourceCluster.status !== TeamClusterStatus.Connected || !sourceCapabilities.servesStorageReads) {
            throw ApplicationError.conflict('ClusterTransfer::SourceClusterUnavailable', 'Source cluster must be connected and able to serve authoritative storage reads');
        }

        const destinationCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(destinationCluster.roleConfig);
        if (destinationCluster.status !== TeamClusterStatus.Connected || !destinationCapabilities.acceptsStorageWrites) {
            throw ApplicationError.conflict('ClusterTransfer::DestinationClusterUnavailable', 'Destination cluster must be connected and able to accept storage writes');
        }

        const placements: StoragePlacement[] = await this.#storagePlacementService.resolveTransferPlacementsForCluster(input.teamId, String(sourceCluster._id));
        if (!placements.length) {
            throw ApplicationError.conflict('ClusterTransfer::NoPlacements', 'This cluster has no authoritative storage placements to transfer');
        }

        const requestedJobs: ClusterTransferJob[] = [];
        for (const placement of placements) {
            requestedJobs.push(await this.#transferCoordinator.requestTransfer({
                teamId: input.teamId,
                scopeType: placement.props.scopeType,
                scopeId: placement.props.scopeId,
                destinationClusterId: String(destinationCluster._id),
                requestedBy: input.authenticatedUserId
            }));
        }

        this.#transferRunner.kick(Math.min(Math.max(requestedJobs.length, 1), 10));

        return {
            message: requestedJobs.length === 1
                ? 'Queued 1 transfer job for this cluster.'
                : `Queued ${requestedJobs.length} transfer jobs for this cluster.`,
            sourceClusterId: String(sourceCluster._id),
            destinationClusterId: String(destinationCluster._id),
            requestedJobs: requestedJobs.map((job) => this.#presentClusterTransferJobEntity(job))
        };
    }

    async getResourceLimits(input: { teamId: string; teamClusterId: string }): Promise<{ resourceLimits: ClusterResourceLimitsDTO }> {
        await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const metrics = await this.#systemMetricsRepository.getLatestByClusterId(input.teamClusterId);
        if (!metrics) {
            return { resourceLimits: { maxCpus: null, maxMemoryMB: null, status: null, lastUpdatedAt: null } };
        }

        return {
            resourceLimits: {
                maxCpus: metrics.cpu.cores,
                maxMemoryMB: Math.floor(metrics.memory.total * MB_PER_GB),
                status: metrics.status,
                lastUpdatedAt: metrics.timestamp.toISOString()
            }
        };
    }

    async revealCredentials(input: { teamId: string; teamClusterId: string; userId: string; password: string }): Promise<{ teamClusterId: string; services: TeamClusterCredentialServicesDTO }> {
        const doc = await this.#getOwnedTeamClusterWithSensitiveData(input.teamClusterId, input.teamId);

        const passwordError = await assertConfirmedPassword({
            userRepository: this.#userRepository,
            passwordHasher: this.#passwordHasher,
            userId: input.userId,
            password: input.password
        });
        if (passwordError) {
            throw passwordError;
        }

        const services = doc.services;
        const teamClusterId = String(doc._id);

        const revealedServices: TeamClusterCredentialServicesDTO = {
            minio: {
                port: services.minio.port,
                username: await this.#decryptRequiredValue(services.minio.username, teamClusterId, 'services.minio.username'),
                password: await this.#decryptRequiredValue(services.minio.password, teamClusterId, 'services.minio.password')
            },
            redis: {
                port: services.redis.port,
                username: await this.#decryptRequiredValue(services.redis.username, teamClusterId, 'services.redis.username'),
                password: await this.#decryptRequiredValue(services.redis.password, teamClusterId, 'services.redis.password')
            },
            mongodb: {
                port: services.mongodb.port,
                username: await this.#decryptRequiredValue(services.mongodb.username, teamClusterId, 'services.mongodb.username'),
                password: await this.#decryptRequiredValue(services.mongodb.password, teamClusterId, 'services.mongodb.password')
            },
            daemon: {
                port: services.daemon.port,
                password: await this.#decryptRequiredValue(services.daemon.password, teamClusterId, 'services.daemon.password')
            }
        };

        logger.info(`Team cluster credentials revealed teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return { teamClusterId: input.teamClusterId, services: revealedServices };
    }

    async createRemoteAccessSession(input: { teamId: string; teamClusterId: string; userId: string; password: string; target: TeamClusterRemoteAccessTargetDTO }): Promise<{ session: TeamClusterRemoteAccessSessionDTO }> {
        await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const passwordError = await assertConfirmedPassword({
            userRepository: this.#userRepository,
            passwordHasher: this.#passwordHasher,
            userId: input.userId,
            password: input.password
        });
        if (passwordError) {
            throw passwordError;
        }

        const session = this.#remoteAccessSessionService.createSession({
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });

        logger.info(`Created team cluster remote access session teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} target=${input.target}`);

        return { session };
    }

    async listRemoteExplorerEntries(input: { teamId: string; teamClusterId: string; userId: string; sessionId: string; target: TeamClusterRemoteAccessTargetDTO; path: string }): Promise<{
        teamClusterId: string;
        target: TeamClusterRemoteAccessTargetDTO;
        path: string;
        entries: TeamClusterRemoteExplorerEntryDTO[];
    }> {
        const preflight = await this.#preflightRemoteExplorerAccess(input);

        try {
            const entries = await this.#remoteExplorerDaemonGateway.listEntries({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            return { teamClusterId: preflight.teamClusterId, target: preflight.target, path: input.path, entries };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.badRequest('TeamCluster::RemoteExplorerListFailed', error instanceof Error ? error.message : 'Failed to load remote explorer entries');
        }
    }

    async getRemoteExplorerNode(input: { teamId: string; teamClusterId: string; userId: string; sessionId: string; target: TeamClusterRemoteAccessTargetDTO; path: string }): Promise<{
        teamClusterId: string;
        target: TeamClusterRemoteAccessTargetDTO;
        node: TeamClusterRemoteExplorerNodeDTO;
    }> {
        const preflight = await this.#preflightRemoteExplorerAccess(input);

        try {
            const node = await this.#remoteExplorerDaemonGateway.getNode({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            return { teamClusterId: preflight.teamClusterId, target: preflight.target, node };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.badRequest('TeamCluster::RemoteExplorerNodeFailed', error instanceof Error ? error.message : 'Failed to load remote explorer node');
        }
    }

    async downloadRemoteExplorerObject(input: { teamId: string; teamClusterId: string; userId: string; sessionId: string; target: TeamClusterRemoteAccessTargetDTO; path: string }): Promise<{
        stream: Readable;
        headers: Record<string, string>;
        prepare?: () => Promise<void>;
    }> {
        const preflight = await this.#preflightRemoteExplorerAccess(input);

        try {
            const response = await this.#remoteExplorerDaemonGateway.downloadObject({
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path
            });

            const contentType = response.headers['content-type'] || 'application/octet-stream';
            const contentLengthHeader = response.headers['content-length'];
            const contentLength = typeof contentLengthHeader === 'string' ? Number(contentLengthHeader) : undefined;

            const filename = this.#readFilenameFromContentDisposition(response.headers['content-disposition'])
                || this.#deriveRemoteExplorerFallbackFilename(preflight.target, input.path);

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType,
                filename,
                contentLength: typeof contentLength === 'number' && Number.isFinite(contentLength) ? contentLength : undefined,
                disposition: 'attachment'
            });
        } catch (error: unknown) {
            if (
                error instanceof ApplicationError
                && error.code === ErrorCodes.TEAM_CLUSTER_DAEMON_STREAM_REQUEST_FAILED
                && error.statusCode === 404
            ) {
                throw ApplicationError.notFound('TeamCluster::RemoteExplorerObjectNotFound', 'The requested remote explorer object was not found');
            }

            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.badRequest('TeamCluster::RemoteExplorerDownloadFailed', error instanceof Error ? error.message : 'Failed to download remote explorer object');
        }
    }

    async regenerateEnrollmentToken(input: { teamId: string; userId: string; teamClusterId: string }): Promise<{ enrollmentToken: string }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        if (!WAITING_STATUSES.has(doc.status)) {
            throw ApplicationError.conflict('TeamCluster::InvalidStatusForTokenRegeneration', 'Enrollment token can only be regenerated for clusters in a waiting or disconnected state');
        }

        const enrollmentToken = createEnrollmentToken();
        const enrollmentTokenHash = hashEnrollmentToken(enrollmentToken);

        await TeamClusterModel.updateOne({ _id: input.teamClusterId }, { $set: { enrollmentTokenHash } });

        logger.info(`Team cluster enrollment token regenerated teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return { enrollmentToken };
    }

    async deleteById(input: { teamId: string; teamClusterId: string; userId: string; password: string }): Promise<{
        success: boolean;
        deleted: boolean;
        manualUninstallRequired: boolean;
        message: string;
        manualUninstallCommand?: string;
        teamCluster?: TeamClusterDTO;
    }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const passwordError = await assertConfirmedPassword({
            userRepository: this.#userRepository,
            passwordHasher: this.#passwordHasher,
            userId: input.userId,
            password: input.password
        });
        if (passwordError) {
            throw passwordError;
        }

        if (doc.status === TeamClusterStatus.Deleting) {
            throw ApplicationError.conflict('TeamCluster::DeletionAlreadyInProgress', 'Team cluster deletion is already in progress');
        }

        if (doc.status === TeamClusterStatus.Connected) {
            let uninstallCommandResult: TeamClusterDaemonSemanticCommandResult<{ accepted?: boolean; reason?: string; message?: string }>;

            try {
                uninstallCommandResult = await this.#teamClusterDaemonClient.commandWithSemanticResult<{ accepted?: boolean; reason?: string; message?: string }>(
                    input.teamClusterId,
                    ChannelCommands.RuntimeUninstall,
                    { reason: `Delete requested by user ${input.userId}` },
                    { timeoutClass: 'long-running-control-plane' }
                );
            } catch {
                logger.warn(`Failed to request remote team cluster uninstall teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

                throw ApplicationError.conflict('TeamCluster::RemoteUninstallRequestFailed', 'Failed to request uninstall from the connected cluster daemon');
            }

            if (!uninstallCommandResult.accepted) {
                const rejectionReason = uninstallCommandResult.reason
                    || uninstallCommandResult.data?.reason
                    || uninstallCommandResult.data?.message
                    || 'The daemon rejected the uninstall request.';

                logger.warn(`Cluster daemon rejected runtime.uninstall command teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} reason=${rejectionReason}`);

                throw ApplicationError.conflict('TeamCluster::RemoteUninstallRejected', rejectionReason);
            }

            const updatedTeamCluster = await this.#lifecycleService.markDeleting(input.teamClusterId);

            logger.info(`Team cluster uninstall requested from daemon teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

            return {
                success: true,
                deleted: false,
                manualUninstallRequired: false,
                message: 'Remote uninstall requested. Volt will remove the cluster after the daemon confirms cleanup or the connection times out.',
                teamCluster: updatedTeamCluster
            };
        }

        const manualUninstallRequired = this.#shouldRequireManualUninstall(doc.status, doc.installedVersion, doc.services.daemon.port);
        const manualUninstallCommand = manualUninstallRequired
            ? buildManualTeamClusterUninstallCommand(String(doc._id), doc.installRoot)
            : undefined;

        await this.#lifecycleService.deleteTeamCluster(teamClusterMapper.toDomain(doc));

        logger.info(`Team cluster deleted without remote uninstall confirmation teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId} manualUninstallRequired=${manualUninstallRequired}`);

        return {
            success: true,
            deleted: true,
            manualUninstallRequired,
            message: manualUninstallRequired
                ? 'Volt removed the cluster from the control plane. Remote uninstall could not be confirmed, so run the manual uninstall command on the host if the stack is still installed.'
                : 'Team cluster deleted from the control plane.',
            manualUninstallCommand
        };
    }

    // ---- Daemon-facing lifecycle -----------------------------------------

    async processHealthcheck(input: { teamClusterId: string; enrollmentToken: string; installedVersion?: string }): Promise<{ teamCluster: TeamClusterDTO; daemonPassword: string }> {
        try {
            return await this.#lifecycleService.processHealthcheck(input.teamClusterId, input.enrollmentToken, input.installedVersion);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process team cluster healthcheck');
        }
    }

    async generateInstallManifest(input: { teamClusterId: string; daemonPassword: string; installRoot: string; ports: TeamClusterInstallManifestPortsDTO }): Promise<{ manifest: TeamClusterInstallManifestDTO }> {
        try {
            const manifest = await this.#installManifestService.generateInstallManifest(
                input.teamClusterId,
                input.daemonPassword,
                input.installRoot,
                input.ports
            );

            return { manifest };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to generate team cluster install manifest');
        }
    }

    async completeDeletion(input: { teamClusterId: string; daemonPassword: string }): Promise<{ success: boolean }> {
        try {
            await this.#lifecycleService.completeDeletion(input.teamClusterId, input.daemonPassword);

            return { success: true };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                if (error.statusCode === 404) {
                    return { success: true };
                }

                throw error;
            }

            throw ApplicationError.internalServerError('Failed to complete team cluster deletion');
        }
    }

    async recordHeartbeat(input: {
        teamClusterId: string;
        daemonPassword: string;
        installedVersion?: string;
        runtime?: { roleConfig: TeamClusterRuntimeRoleConfigProps };
        metrics?: TeamClusterHeartbeatMetricsDTO;
    }): Promise<{ teamCluster: TeamClusterDTO }> {
        try {
            const teamCluster = await this.#lifecycleService.recordHeartbeat(
                input.teamClusterId,
                input.daemonPassword,
                input.installedVersion,
                input.runtime,
                input.metrics
            );

            return { teamCluster };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to record team cluster heartbeat');
        }
    }

    async updateLifecycle(input: { teamClusterId: string; daemonPassword: string; status: TeamClusterStatus; installedVersion?: string }): Promise<{ teamCluster: TeamClusterDTO }> {
        if (input.status === TeamClusterStatus.Connected) {
            throw ApplicationError.badRequest('TeamCluster::SocketLifecycleOnly', 'Connected status is managed by daemon socket registration');
        }

        if (input.status === TeamClusterStatus.WaitingForConnection) {
            throw ApplicationError.badRequest('TeamCluster::LifecycleStatusInvalid', 'Waiting-for-connection is managed by the control plane');
        }

        try {
            const teamCluster = await this.#lifecycleService.updateLifecycleStatus(
                input.teamClusterId,
                input.daemonPassword,
                input.status,
                input.installedVersion
            );

            return { teamCluster };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to update team cluster lifecycle');
        }
    }

    async processDaemonJobCompletion(input: ProcessDaemonJobCompletionInputDTO): Promise<ProcessDaemonJobCompletionOutputDTO> {
        try {
            await this.#lifecycleService.authenticateDaemonConnection(input.teamClusterId, input.daemonPassword);

            if (this.#isAnalysisStageStatusInput(input)) {
                await this.#daemonAnalysisCompletionService.handleAnalysisStageStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    name: input.name,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    stageKey: input.stageKey,
                    label: input.label,
                    stageType: input.stageType,
                    stageStatus: input.stageStatus,
                    pluginId: input.pluginId,
                    pluginDisplayName: input.pluginDisplayName,
                    nodeId: input.nodeId,
                    exposureId: input.exposureId,
                    configHash: input.configHash,
                    cacheHit: input.cacheHit,
                    detail: input.detail,
                    startedAt: input.startedAt,
                    finishedAt: input.finishedAt,
                    durationMs: input.durationMs
                });

                return { acknowledged: true };
            }

            if (this.#isAnalysisJobStatusInput(input)) {
                await this.#daemonAnalysisCompletionService.handleAnalysisJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    name: input.name,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return { acknowledged: true };
            }

            if (this.#isAnalysisJobCompletionInput(input)) {
                await this.#daemonAnalysisCompletionService.handleJobCompletion({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    name: input.name,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    success: input.success,
                    error: input.error
                });

                return { acknowledged: true };
            }

            if (this.#isGlbJobStatusInput(input)) {
                await this.#daemonAnalysisCompletionService.handleGlbJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return { acknowledged: true };
            }

            if (this.#isArtifactUploadJobStatusInput(input)) {
                await this.#daemonAnalysisCompletionService.handleArtifactUploadJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return { acknowledged: true };
            }

            if (this.#isRasterJobStatusInput(input)) {
                await this.#daemonAnalysisCompletionService.handleRasterJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return { acknowledged: true };
            }

            throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_INVALID_JOB_COMPLETION_PAYLOAD', 'Invalid daemon job completion payload');
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process daemon job completion');
        }
    }

    async processDaemonSceneArtifactUpsert(input: ProcessDaemonSceneArtifactUpsertInputDTO): Promise<ProcessDaemonSceneArtifactUpsertOutputDTO> {
        try {
            const entries = await this.#prepareSceneArtifactUpsertEntries([input]);
            await this.#sceneArtifactRepository.upsertManyByObjectName(entries);
            await this.#markAnalysisArtifactsReady(entries);
            await this.#publishSceneArtifactBatchUpserted(entries);

            return { acknowledged: true };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process daemon scene artifact upsert');
        }
    }

    async processDaemonSceneArtifactUpsertBatch(inputs: ProcessDaemonSceneArtifactUpsertInputDTO[]): Promise<ProcessDaemonSceneArtifactUpsertOutputDTO> {
        try {
            const entries = await this.#prepareSceneArtifactUpsertEntries(inputs);
            await this.#sceneArtifactRepository.upsertManyByObjectName(entries);
            await this.#markAnalysisArtifactsReady(entries);
            await this.#publishSceneArtifactBatchUpserted(entries);

            return { acknowledged: true };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process daemon scene artifact upsert batch');
        }
    }

    // ---- Internal helpers -------------------------------------------------

    async #getOwnedTeamCluster(teamClusterId: string, teamId: string): Promise<HydratedDocument<TeamClusterDocument>> {
        const doc = await TeamClusterModel.findById(teamClusterId);
        if (!doc || String(doc.team) !== teamId) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }
        return doc;
    }

    async #getOwnedTeamClusterWithSensitiveData(teamClusterId: string, teamId: string): Promise<HydratedDocument<TeamClusterDocument>> {
        const doc = await TeamClusterModel.findById(teamClusterId).select(SENSITIVE_FIELDS_SELECTION);
        if (!doc || String(doc.team) !== teamId) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }
        return doc;
    }

    async #preflightRemoteExplorerAccess(input: { teamId: string; teamClusterId: string; sessionId: string; target: TeamClusterRemoteAccessTargetDTO; userId: string }): Promise<{ teamClusterId: string; target: TeamClusterRemoteAccessTargetDTO }> {
        await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const sessionResult = this.#remoteAccessSessionService.validateSession({
            sessionId: input.sessionId,
            userId: input.userId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            target: input.target
        });
        if (sessionResult instanceof Error) {
            throw sessionResult;
        }

        return { teamClusterId: input.teamClusterId, target: input.target };
    }

    #isMongoDuplicateKeyError(error: unknown): error is { code?: number } {
        return typeof error === 'object' && error !== null && 'code' in error;
    }

    #buildDemoPlaintextCredentials(enrollmentToken: string): DemoClusterPlaintextCredentials {
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
    }

    async #scheduleExpiredDemoCleanup(teamClusterId: string, teamId: string): Promise<void> {
        try {
            await this.#lifecycleService.markDeleting(teamClusterId);
        } catch (error: unknown) {
            logger.warn(`[ClusterService.getDemoStatus] markDeleting failed teamClusterId=${teamClusterId} error=${(error as Error).message}`);
        }

        const teamCluster = await TeamClusterModel.findById(teamClusterId);
        if (!teamCluster) {
            return;
        }

        try {
            await this.#demoDeploymentService.teardownDemoStack(teamClusterMapper.toDomain(teamCluster));
            await this.#lifecycleService.deleteTeamCluster(teamClusterMapper.toDomain(teamCluster));
            logger.info(`[ClusterService.getDemoStatus] Expired demo cleaned up teamClusterId=${teamClusterId} teamId=${teamId}`);
        } catch (error: unknown) {
            logger.error(error, `[ClusterService.getDemoStatus] Expired demo cleanup failed teamClusterId=${teamClusterId} teamId=${teamId}`);
        }
    }

    async #decryptRequiredValue(value: string | undefined, teamClusterId: string, field: string): Promise<string> {
        if (!value) {
            throw ApplicationError.internalServerError(`Missing sensitive field ${field} for team cluster ${teamClusterId}`);
        }
        return this.#credentialsCipher.decrypt(value);
    }

    #shouldRequireManualUninstall(status: TeamClusterStatus, installedVersion: string | null, daemonPort: number | null): boolean {
        if (status === TeamClusterStatus.WaitingForConnection) {
            return installedVersion !== null || daemonPort !== null;
        }
        return status !== TeamClusterStatus.Connected;
    }

    #deriveRemoteExplorerFallbackFilename(target: TeamClusterRemoteAccessTargetDTO, path: string): string {
        const lastSegment = path.split('/').filter(Boolean).pop() ?? 'download';

        if (target === TeamClusterRemoteAccessTargetDTO.MongoDocuments) {
            return `${lastSegment}.json`;
        }
        if (target === TeamClusterRemoteAccessTargetDTO.RedisData) {
            return `${lastSegment}.json`;
        }
        return lastSegment;
    }

    #readFilenameFromContentDisposition(value: string | undefined): string | undefined {
        if (!value) {
            return undefined;
        }

        const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match?.[1]) {
            return decodeURIComponent(utf8Match[1]);
        }

        const quotedMatch = value.match(/filename="([^"]+)"/i);
        if (quotedMatch?.[1]) {
            return quotedMatch[1];
        }

        const bareMatch = value.match(/filename=([^;]+)/i);
        return bareMatch?.[1]?.trim();
    }

    #presentTeamCluster(doc: TeamClusterDocument, options: { activeTransfers?: ClusterTransferJobDTO[] } = {}): TeamClusterDTO {
        const services = doc.services;
        const roleConfig = doc.roleConfig;
        const effectiveCapabilities = resolveEffectiveCapabilitiesFromRoleConfig(roleConfig);
        const activeTransfers = options.activeTransfers;

        return {
            _id: String(doc._id),
            name: doc.name,
            team: String(doc.team),
            createdBy: String(doc.createdBy),
            status: doc.status,
            installedVersion: doc.installedVersion,
            lastHeartbeatAt: doc.lastHeartbeatAt,
            lastDisconnectAt: doc.lastDisconnectAt,
            services: {
                minio: { port: services.minio.port },
                redis: { port: services.redis.port },
                mongodb: { port: services.mongodb.port },
                daemon: { port: services.daemon.port }
            },
            queueConcurrency: this.#presentQueueConcurrency(doc.queueConcurrency),
            queueScopeLimits: this.#presentQueueScopeLimits(doc.queueScopeLimits ?? DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS),
            roleConfig: {
                desiredRole: roleConfig.desiredRole,
                effectiveRole: roleConfig.effectiveRole,
                runtimeVersion: roleConfig.runtimeVersion,
                draining: { ...roleConfig.draining },
                lastAppliedAt: roleConfig.lastAppliedAt ?? null
            },
            effectiveCapabilities: { ...effectiveCapabilities },
            ...(activeTransfers ? { activeTransfers } : {}),
            isDemo: doc.isDemo,
            demoExpiresAt: doc.demoExpiresAt,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }

    #presentQueueConcurrency(queueConcurrency: TeamClusterQueueConcurrencyProps): TeamClusterQueueConcurrencyDTO {
        return {
            analysis: queueConcurrency.analysis,
            rasterizer: queueConcurrency.rasterizer,
            glbPreprocessing: queueConcurrency.glbPreprocessing,
            artifactUpload: queueConcurrency.artifactUpload,
            pluginWarmup: queueConcurrency.pluginWarmup
        };
    }

    #presentQueueScopeLimits(queueScopeLimits: TeamClusterQueueScopeLimitsProps): TeamClusterQueueScopeLimitsDTO {
        return {
            analysisProcessing: { maxRunningPerTrajectory: queueScopeLimits.analysisProcessing.maxRunningPerTrajectory },
            artifactUpload: { maxRunningPerTrajectory: queueScopeLimits.artifactUpload.maxRunningPerTrajectory },
            trajectoryRasterization: { maxRunningPerTrajectory: queueScopeLimits.trajectoryRasterization.maxRunningPerTrajectory },
            trajectoryGlbConversion: { maxRunningPerTrajectory: queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory }
        };
    }

    #presentClusterTransferJob(doc: ClusterTransferJobDocument): ClusterTransferJobDTO {
        return {
            _id: String(doc._id),
            team: String(doc.team),
            scopeType: doc.scopeType,
            scopeId: doc.scopeId,
            sourceClusterId: doc.sourceClusterId,
            destinationClusterId: doc.destinationClusterId,
            buckets: doc.buckets.map((bucketRef) => ({ bucket: bucketRef.bucket, prefix: bucketRef.prefix })),
            state: doc.state,
            reason: doc.reason,
            cleanupSource: doc.cleanupSource,
            requestedBy: doc.requestedBy,
            cursor: { bucketIndex: doc.cursor.bucketIndex, lastObjectKey: doc.cursor.lastObjectKey },
            stats: {
                copiedObjects: doc.stats.copiedObjects,
                copiedBytes: doc.stats.copiedBytes,
                verifiedObjects: doc.stats.verifiedObjects,
                verifiedBytes: doc.stats.verifiedBytes,
                deletedObjects: doc.stats.deletedObjects
            },
            errorCode: doc.errorCode,
            errorMessage: doc.errorMessage,
            startedAt: doc.startedAt,
            finishedAt: doc.finishedAt,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }

    #presentClusterTransferJobEntity(job: ClusterTransferJob): ClusterTransferJobDTO {
        return {
            _id: job.id,
            team: job.props.team,
            scopeType: job.props.scopeType,
            scopeId: job.props.scopeId,
            sourceClusterId: job.props.sourceClusterId,
            destinationClusterId: job.props.destinationClusterId,
            buckets: job.props.buckets.map((bucketRef) => ({ bucket: bucketRef.bucket, prefix: bucketRef.prefix })),
            state: job.props.state,
            reason: job.props.reason,
            cleanupSource: job.props.cleanupSource,
            requestedBy: job.props.requestedBy,
            cursor: { bucketIndex: job.props.cursor.bucketIndex, lastObjectKey: job.props.cursor.lastObjectKey },
            stats: { ...job.props.stats },
            errorCode: job.props.errorCode,
            errorMessage: job.props.errorMessage,
            startedAt: job.props.startedAt,
            finishedAt: job.props.finishedAt,
            createdAt: job.props.createdAt,
            updatedAt: job.props.updatedAt
        };
    }

    // ---- Daemon job-completion type guards (folded from ProcessDaemonJobCompletionUseCase) --

    #isAnalysisJobStatusInput(input: ProcessDaemonJobCompletionInputDTO): input is ProcessDaemonAnalysisJobStatusInputDTO {
        return 'analysisId' in input && 'name' in input && 'status' in input && !('success' in input);
    }

    #isAnalysisStageStatusInput(input: ProcessDaemonJobCompletionInputDTO): input is ProcessDaemonAnalysisStageStatusInputDTO {
        return 'analysisId' in input
            && 'name' in input
            && 'stageKey' in input
            && 'stageStatus' in input
            && 'stageType' in input;
    }

    #isAnalysisJobCompletionInput(input: ProcessDaemonJobCompletionInputDTO): input is ProcessDaemonAnalysisJobCompletionInputDTO {
        return 'analysisId' in input && 'name' in input && 'success' in input && !this.#hasJobStatusFields(input);
    }

    #isGlbJobStatusInput(input: ProcessDaemonJobCompletionInputDTO): input is ValidProcessDaemonGlbJobStatusInputDTO {
        return this.#hasJobStatusFields(input)
            && !this.#hasAnalysisJobCompletionFields(input)
            && this.#isGlbJobId(input.jobId)
            && this.#isValidJobStatus(input.status);
    }

    #isArtifactUploadJobStatusInput(input: ProcessDaemonJobCompletionInputDTO): input is ValidProcessDaemonArtifactUploadJobStatusInputDTO {
        return this.#hasJobStatusFields(input)
            && !this.#hasAnalysisJobCompletionFields(input)
            && this.#isArtifactUploadJobId(input.jobId)
            && this.#isValidArtifactUploadJobStatus(input.status);
    }

    #isRasterJobStatusInput(input: ProcessDaemonJobCompletionInputDTO): input is ValidProcessDaemonRasterJobStatusInputDTO {
        return this.#hasJobStatusFields(input)
            && !this.#hasAnalysisJobCompletionFields(input)
            && !this.#isGlbJobId(input.jobId)
            && !this.#isArtifactUploadJobId(input.jobId)
            && this.#isValidJobStatus(input.status);
    }

    #hasAnalysisJobCompletionFields(input: ProcessDaemonJobCompletionInputDTO): boolean {
        return 'name' in input || 'success' in input;
    }

    #hasJobStatusFields(input: ProcessDaemonJobCompletionInputDTO): input is ProcessDaemonRasterJobStatusInputDTO {
        return 'jobId' in input && 'trajectoryId' in input && 'status' in input;
    }

    #isGlbJobId(jobId: string): boolean {
        return jobId.startsWith('trajectory-glb:') || jobId.startsWith('trajectory-frame:');
    }

    #isArtifactUploadJobId(jobId: string): boolean {
        return jobId.startsWith('artifact-upload-');
    }

    #isValidJobStatus(status: JobStatus): status is RasterJobStatus {
        return status === JobStatus.Running || status === JobStatus.Completed || status === JobStatus.Failed;
    }

    #isValidArtifactUploadJobStatus(status: JobStatus): status is ArtifactUploadJobStatus {
        return status === JobStatus.Queued
            || status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed;
    }

    // ---- Daemon scene-artifact-upsert helpers (folded from ProcessDaemonSceneArtifactUpsertUseCase) --

    async #publishSceneArtifactBatchUpserted(entries: PreparedSceneArtifactUpsertEntry[]): Promise<void> {
        if (!entries.length) {
            return;
        }

        const groups = new Map<string, { teamId: string; trajectoryId: string; analysisId?: string; artifacts: SceneArtifactBatchUpsertedArtifact[] }>();

        for (const entry of entries) {
            const key = `${entry.data.trajectory}::${entry.data.analysis ?? ''}`;
            let group = groups.get(key);
            if (!group) {
                group = {
                    teamId: entry.teamId,
                    trajectoryId: entry.data.trajectory,
                    analysisId: entry.data.analysis,
                    artifacts: []
                };
                groups.set(key, group);
            }
            group.artifacts.push({
                objectName: entry.objectName,
                trajectoryId: entry.data.trajectory,
                analysisId: entry.data.analysis,
                pluginId: entry.data.plugin,
                sourceType: entry.data.sourceType,
                timestep: entry.data.timestep,
                displayName: entry.data.displayName,
                status: entry.data.status
            });
        }

        await Promise.all(Array.from(groups.values()).map((group) =>
            this.#eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.SceneArtifactBatchUpserted, group)).catch((err) => {
                logger.warn({ err, trajectoryId: group.trajectoryId, analysisId: group.analysisId },
                    '[ClusterService.processDaemonSceneArtifactUpsert] Failed to publish scene-artifact.upserted');
            })
        ));
    }

    async #markAnalysisArtifactsReady(entries: PreparedSceneArtifactUpsertEntry[]): Promise<void> {
        const grouped = new Map<string, PreparedSceneArtifactUpsertEntry[]>();
        for (const entry of entries) {
            if (!entry.data.analysis || entry.data.sourceType !== 'plugin-exposure') {
                continue;
            }

            const group = grouped.get(entry.data.analysis) ?? [];
            group.push(entry);
            grouped.set(entry.data.analysis, group);
        }

        await Promise.all(Array.from(grouped.entries()).map(async ([analysisId, group]) => {
            const analysis = await this.#analysisRepository.findById(analysisId);
            if (!analysis) {
                return;
            }

            const expectedArtifacts = this.#updateExpectedArtifacts(analysis.props.expectedArtifacts ?? [], group);
            const artifactStatus = expectedArtifacts.length > 0
                && expectedArtifacts.every((artifact) => artifact.status === 'ready')
                ? 'ready'
                : (analysis.props.artifactStatus ?? 'uploading');

            const updatedAnalysis = await this.#analysisRepository.updateById(analysisId, { expectedArtifacts, artifactStatus });
            if (!updatedAnalysis) {
                return;
            }

            await this.#eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.AnalysisStageChanged, {
                analysisId,
                teamId: group[0]!.teamId,
                trajectoryId: updatedAnalysis.props.trajectory,
                artifactStatus: updatedAnalysis.props.artifactStatus,
                expectedArtifacts: updatedAnalysis.props.expectedArtifacts,
                stages: updatedAnalysis.props.stages,
                childAnalyses: updatedAnalysis.props.childAnalyses
            })).catch((err) => {
                logger.warn({ err, analysisId }, '[ClusterService.processDaemonSceneArtifactUpsert] Failed to publish analysis.stage.changed after artifact upsert');
            });
        }));
    }

    #updateExpectedArtifacts(expectedArtifacts: AnalysisExpectedArtifact[], entries: PreparedSceneArtifactUpsertEntry[]): AnalysisExpectedArtifact[] {
        if (!expectedArtifacts.length) {
            return expectedArtifacts;
        }

        const byExposureId = new Map<string, PreparedSceneArtifactUpsertEntry>();
        for (const entry of entries) {
            const exposureId = entry.data.params.exposureId;
            if (typeof exposureId === 'string' && exposureId.length > 0) {
                byExposureId.set(exposureId, entry);
            }
        }

        return expectedArtifacts.map((artifact) => {
            const entry = byExposureId.get(artifact.exposureId);
            if (!entry) {
                return artifact;
            }

            return {
                ...artifact,
                status: entry.data.status === 'ready' ? 'ready' : 'failed',
                objectName: entry.objectName,
                readyAt: entry.data.status === 'ready' ? new Date() : artifact.readyAt
            };
        });
    }

    async #prepareSceneArtifactUpsertEntries(inputs: ProcessDaemonSceneArtifactUpsertInputDTO[]): Promise<PreparedSceneArtifactUpsertEntry[]> {
        if (!inputs.length) {
            return [];
        }

        const [firstInput] = inputs;
        if (!firstInput) {
            return [];
        }

        for (const input of inputs) {
            if (input.teamClusterId !== firstInput.teamClusterId || input.daemonPassword !== firstInput.daemonPassword) {
                throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_BATCH_AUTH_MISMATCH', 'All scene artifact upserts in a batch must share the same daemon credentials');
            }
        }

        await this.#lifecycleService.authenticateDaemonConnection(firstInput.teamClusterId, firstInput.daemonPassword);

        const trajectoryIds = Array.from(new Set(inputs.map((input) => input.trajectory)));
        const trajectories = await Promise.all(
            trajectoryIds.map(async (trajectoryId) => {
                const trajectory = await this.#trajectoryRepository.findById(trajectoryId);
                return [trajectoryId, trajectory] as const;
            })
        );
        const trajectoryById = new Map(trajectories);

        const analysisIds = Array.from(
            new Set(
                inputs
                    .map((input) => input.analysis)
                    .filter((analysisId): analysisId is string => typeof analysisId === 'string' && analysisId.length > 0)
            )
        );
        const analyses = await Promise.all(
            analysisIds.map(async (analysisId) => {
                const analysis = await this.#analysisRepository.findById(analysisId);
                return [analysisId, analysis] as const;
            })
        );
        const analysisById = new Map(analyses);

        return inputs.map((input) => {
            const trajectory = trajectoryById.get(input.trajectory);
            if (!trajectory) {
                throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND', 'Trajectory not found');
            }

            const trajectoryStorageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);
            if (!trajectoryStorageClusterId) {
                throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_TRAJECTORY_STORAGE_CLUSTER_REQUIRED', 'Trajectory storage cluster is required before accepting scene artifacts');
            }

            if (input.storageClusterId !== trajectoryStorageClusterId) {
                throw ApplicationError.forbidden('TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH', 'Reported storage cluster does not match the trajectory storage cluster');
            }

            let sanitizedAnalysisId = input.analysis;
            let sanitizedPluginId = input.plugin;
            let sanitizedStorageClusterId = trajectoryStorageClusterId;
            let isReporterAuthorized = input.teamClusterId === trajectoryStorageClusterId;

            if (input.analysis) {
                const analysis = analysisById.get(input.analysis);
                if (!analysis) {
                    throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND', 'Analysis not found');
                }

                if (analysis.props.trajectory !== trajectory.id) {
                    throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH', 'Analysis does not belong to the provided trajectory');
                }

                if (analysis.props.team !== trajectory.props.team) {
                    throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH', 'Analysis ownership does not match its trajectory');
                }

                const analysisStorageClusterId = resolveAnalysisStorageClusterId(analysis.props);
                if (!analysisStorageClusterId) {
                    throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_ANALYSIS_STORAGE_CLUSTER_REQUIRED', 'Analysis storage cluster is required before accepting scene artifacts');
                }

                if (input.storageClusterId !== analysisStorageClusterId) {
                    throw ApplicationError.forbidden('TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH', 'Reported storage cluster does not match the analysis storage cluster');
                }

                if (input.sourceType === 'plugin-exposure') {
                    const analysisComputeClusterId = resolveAnalysisComputeClusterId(analysis.props);
                    isReporterAuthorized = input.teamClusterId === analysisStorageClusterId
                        || (typeof analysisComputeClusterId === 'string' && analysisComputeClusterId === input.teamClusterId);
                } else {
                    isReporterAuthorized = input.teamClusterId === analysisStorageClusterId;
                }

                if (!isReporterAuthorized) {
                    throw ApplicationError.forbidden(
                        'TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH',
                        input.sourceType === 'plugin-exposure'
                            ? 'Plugin exposure artifacts must be reported by the analysis compute or storage cluster'
                            : 'Analysis storage does not belong to the authenticated team cluster'
                    );
                }

                if (input.plugin && input.plugin !== analysis.props.plugin) {
                    throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH', 'Payload plugin does not match persisted analysis ownership');
                }

                sanitizedAnalysisId = analysis._id;
                sanitizedPluginId = analysis.props.plugin;
                sanitizedStorageClusterId = analysisStorageClusterId;
            }

            if (!isReporterAuthorized) {
                throw ApplicationError.forbidden('TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH', 'Trajectory storage does not belong to the authenticated team cluster');
            }

            return {
                objectName: input.objectName,
                teamId: trajectory.props.team,
                data: {
                    trajectory: trajectory.id,
                    storageClusterId: sanitizedStorageClusterId,
                    analysis: sanitizedAnalysisId,
                    plugin: sanitizedPluginId,
                    sourceType: input.sourceType,
                    timestep: input.timestep,
                    params: input.params,
                    displayName: input.displayName,
                    status: input.status,
                    storageBucket: input.storageBucket,
                    metadata: input.metadata
                }
            };
        });
    }
}
