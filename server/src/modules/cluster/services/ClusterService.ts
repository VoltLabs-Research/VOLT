import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import { ErrorCodes } from '@core/constants/error-codes';
import UserModel from '@modules/auth/models/UserModel';
import BcryptPasswordHasher from '@modules/auth/services/BcryptPasswordHasher';
import AnalysisModel from '@modules/analysis/models/AnalysisModel';
import TrajectoryModel, { type TrajectoryDocument } from '@modules/trajectory/models/trajectory/TrajectoryModel';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import systemMetricsRepository from '@modules/system/repositories/SystemMetricsRedisRepository';
import type { SystemStatus } from '@modules/system/value-objects/SystemMetrics';
import type { TrajectoryLike } from '@shared/contracts/types';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import type { TeamClusterDaemonSemanticCommandResult } from '@modules/cluster/services/TeamClusterDaemonClient';
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
import type { Readable } from 'node:stream';
import type { HydratedDocument } from 'mongoose';

import TeamClusterModel, { TeamClusterDocument, toTeamClusterLike, type TeamCluster } from '@modules/cluster/models/TeamClusterModel';
import ClusterTransferJobModel, { ClusterTransferJobDocument } from '@modules/cluster/models/ClusterTransferJobModel';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import type {
    TeamClusterRole,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';
import {
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS
} from '@modules/cluster/utilities/team-cluster-defaults';
import { resolveEffectiveCapabilitiesFromRoleConfig } from '@shared/domain/utilities/cluster-capabilities';
import type { ClusterTransferJob } from '@modules/cluster/models/ClusterTransferJobModel';
import type { ClusterTransferJobState } from '@modules/cluster/utilities/cluster-transfer-job';
import type { StoragePlacement } from '@modules/cluster/models/StoragePlacementModel';

import type {
    TeamClusterView,
    TeamClusterQueueConcurrencyView,
    TeamClusterQueueScopeLimitsView,
    TeamClusterCredentialServicesView
} from '@modules/cluster/contracts/TeamClusterView';
import type { ClusterTransferJobView } from '@modules/cluster/contracts/ClusterTransferJobView';
import {
    TeamClusterRemoteAccessTarget,
    type TeamClusterRemoteAccessSessionView,
    type TeamClusterRemoteExplorerEntryView,
    type TeamClusterRemoteExplorerNodeView
} from '@modules/cluster/contracts/TeamClusterRemoteAccess';
import type {
    TeamClusterInstallManifestView,
    TeamClusterInstallManifestPortsView
} from '@modules/cluster/contracts/TeamClusterInstallManifest';
import type { TeamClusterHeartbeatMetricsInput } from '@modules/cluster/contracts/TeamClusterHeartbeat';

import clusterTransferCoordinator from '@modules/cluster/services/ClusterTransferCoordinator';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import clusterTransferRunner from '@modules/cluster/services/ClusterTransferRunner';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import demoClusterDeploymentService from '@modules/cluster/services/DemoClusterDeploymentService';
import type { DemoClusterPlaintextCredentials } from '@modules/cluster/services/DemoClusterDeploymentService';
import TeamClusterCredentialsCipher from '@modules/cluster/services/TeamClusterCredentialsCipher';
import teamClusterInstallManifestService from '@modules/cluster/services/TeamClusterInstallManifestService';
import teamClusterRemoteAccessSessionService from '@modules/cluster/services/TeamClusterRemoteAccessSessionService';
import remoteExplorerDaemonGateway from '@modules/cluster/services/RemoteExplorerDaemonGateway';
import daemonAnalysisCompletionService from '@modules/cluster/services/DaemonAnalysisCompletionService';

import {
    createEnrollmentToken,
    hashEnrollmentToken
} from '@modules/cluster/utilities/enrollmentToken';
import {
    buildTeamClusterProps,
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

interface ClusterResourceLimitsView {
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: SystemStatus | null;
    lastUpdatedAt: string | null;
}

type RasterJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type GlbJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type ArtifactUploadJobStatus = JobStatus.Queued | JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

interface ProcessDaemonAnalysisJobCompletionInput {
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

interface ProcessDaemonAnalysisJobStatusInput {
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

interface ProcessDaemonAnalysisStageStatusInput {
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

interface ProcessDaemonRasterJobStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonRasterJobStatusInput extends ProcessDaemonRasterJobStatusInput {
    status: RasterJobStatus;
}

interface ProcessDaemonGlbJobStatusInput {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
}

interface ValidProcessDaemonGlbJobStatusInput extends ProcessDaemonGlbJobStatusInput {
    status: GlbJobStatus;
}

interface ProcessDaemonArtifactUploadJobStatusInput {
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

interface ValidProcessDaemonArtifactUploadJobStatusInput extends ProcessDaemonArtifactUploadJobStatusInput {
    status: ArtifactUploadJobStatus;
}

export type ProcessDaemonJobCompletionInput =
    | ProcessDaemonAnalysisJobCompletionInput
    | ProcessDaemonAnalysisJobStatusInput
    | ProcessDaemonAnalysisStageStatusInput
    | ProcessDaemonRasterJobStatusInput
    | ProcessDaemonGlbJobStatusInput
    | ProcessDaemonArtifactUploadJobStatusInput;

interface ProcessDaemonJobCompletionOutput {
    acknowledged: boolean;
}

export interface ProcessDaemonSceneArtifactUpsertInput {
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

interface ProcessDaemonSceneArtifactUpsertOutput {
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

export default class ClusterService {
    #userRepository = {
        findById: (userId: string) => UserModel.findById(userId),
        findByIdWithPassword: (userId: string) => UserModel.findById(userId).select('+password')
    };
    #passwordHasher = new BcryptPasswordHasher();
    #systemMetricsRepository = systemMetricsRepository;

        #teamClusterDaemonClient = teamClusterDaemonClient;

        #eventBus = eventBus;

    #toTrajectoryLike(doc: TrajectoryDocument): TrajectoryLike {
        return {
            _id: doc._id.toString(),
            props: {
                name: doc.name,
                team: doc.team.toString(),
                folder: doc.folder ? doc.folder.toString() : null,
                storageClusterId: doc.storageClusterId?.toString(),
                createdBy: doc.createdBy.toString(),
                status: doc.status,
                isPublic: doc.isPublic,
                rasterSceneViews: doc.rasterSceneViews,
                hasPreview: doc.hasPreview,
                stats: doc.stats,
                updatedAt: doc.updatedAt,
                createdAt: doc.createdAt
            }
        };
    }

    async #findTrajectoryById(trajectoryId: string): Promise<TrajectoryLike | null> {
        const doc = await TrajectoryModel.findById(trajectoryId);
        return doc ? this.#toTrajectoryLike(doc) : null;
    }

    async #upsertSceneArtifactsByObjectName(entries: Array<{ objectName: string; data: Record<string, unknown> }>): Promise<void> {
        if (!entries.length) {
            return;
        }

        const operations = entries.map((entry) => ({
            updateOne: {
                filter: { objectName: entry.objectName },
                update: {
                    $set: {
                        ...entry.data,
                        objectName: entry.objectName
                    }
                },
                upsert: true
            }
        }));

        await SceneArtifactModel.bulkWrite(operations, { ordered: false });
    }

    #lifecycleService = teamClusterLifecycleService;
    #demoDeploymentService = demoClusterDeploymentService;
    #credentialsCipher = new TeamClusterCredentialsCipher();
    #installManifestService = teamClusterInstallManifestService;
    #remoteAccessSessionService = teamClusterRemoteAccessSessionService;
    #remoteExplorerDaemonGateway = remoteExplorerDaemonGateway;
    #daemonAnalysisCompletionService = daemonAnalysisCompletionService;
    #transferRunner = clusterTransferRunner;
    #transferCoordinator = clusterTransferCoordinator;
    #storagePlacementService = storagePlacementService;

    async create(input: { teamId: string; userId: string; name: string }): Promise<{ teamCluster: TeamClusterView; enrollmentToken: string }> {
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

        const teamClusterProps = buildTeamClusterProps({
            name: input.name.trim(),
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: encryptedServices,
            isDemo: false,
            demoExpiresAt: null
        });

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
                    await this.#demoDeploymentService.teardownDemoStack(toTeamClusterLike(existingDemo));
                    const refreshed = await TeamClusterModel.findById(existingDemo._id);
                    if (refreshed) {
                        await this.#lifecycleService.deleteTeamCluster(toTeamClusterLike(refreshed));
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

    async listByTeamId(input: { teamId: string; page?: number; limit?: number; search?: string }): Promise<PaginatedResult<TeamClusterView>> {
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
        const activeTransfersByClusterId = new Map<string, ClusterTransferJobView[]>();
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
                const jobView = this.#presentClusterTransferJob(job);

                if (clusterIdSet.has(job.sourceClusterId)) {
                    const sourceJobs = activeTransfersByClusterId.get(job.sourceClusterId) ?? [];
                    sourceJobs.push(jobView);
                    activeTransfersByClusterId.set(job.sourceClusterId, sourceJobs);
                }

                if (job.destinationClusterId !== job.sourceClusterId && clusterIdSet.has(job.destinationClusterId)) {
                    const destinationJobs = activeTransfersByClusterId.get(job.destinationClusterId) ?? [];
                    destinationJobs.push(jobView);
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

    async provisionDemo(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterView }> {
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

        const teamClusterProps = buildTeamClusterProps({
            name: `Demo Cluster ${now.toISOString().slice(0, 16).replace('T', ' ')}`,
            teamId: input.teamId,
            createdBy: input.userId,
            enrollmentTokenHash: hashEnrollmentToken(enrollmentToken),
            services: encryptedServices,
            isDemo: true,
            demoExpiresAt: expiresAt,
            now
        });

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

        void this.#demoDeploymentService.deployDemoStack(toTeamClusterLike(created), credentials).catch((error: unknown) => {
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
                await this.#demoDeploymentService.teardownDemoStack(toTeamClusterLike(target));
                await this.#lifecycleService.deleteTeamCluster(toTeamClusterLike(target));
                logger.info(`[ClusterService.deleteDemo] Demo deleted teamClusterId=${target._id} teamId=${input.teamId}`);
            } catch (error: unknown) {
                logger.error(error, `[ClusterService.deleteDemo] Demo teardown failed teamClusterId=${target._id} teamId=${input.teamId}`);
            }
        })();

        return { teardownScheduled: true };
    }

    async getDemoStatus(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterView | null; remainingMs: number | null; hasActiveDemo: boolean }> {
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

    async getById(input: { teamId: string; teamClusterId: string }): Promise<{ teamCluster: TeamClusterView }> {
        const doc = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);
        return { teamCluster: this.#presentTeamCluster(doc) };
    }

    async getRuntimeSnapshot(input: { teamId: string; teamClusterId: string }): Promise<{
        capturedAt: string;
        queueConcurrency: TeamClusterQueueConcurrencyView;
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
    }): Promise<{ message: string; teamCluster: TeamClusterView }> {
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

        this.#lifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));

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

    async updateRole(input: { teamId: string; userId: string; teamClusterId: string; role: TeamClusterRole }): Promise<{ message: string; teamCluster: TeamClusterView }> {
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

        this.#lifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));

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
                    this.#lifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));
                } else {
                    logger.warn(`Persisted desired role but the daemon rejected the live apply request teamClusterId=${updated._id} teamId=${input.teamId} role=${input.role} reason=${liveApplyResult.reason}`);
                }
            } catch {
                logger.warn(`Persisted desired role but failed to request live daemon role apply teamClusterId=${updated._id} teamId=${input.teamId} role=${input.role}`);
            }
        }

        return { message: 'Team cluster role saved.', teamCluster: this.#presentTeamCluster(updated) };
    }

    async listTransferJobs(input: { teamId: string; teamClusterId: string; page?: number; limit?: number; state?: ClusterTransferJobState }): Promise<PaginatedResult<ClusterTransferJobView>> {
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
        requestedJobs: ClusterTransferJobView[];
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

    async getResourceLimits(input: { teamId: string; teamClusterId: string }): Promise<{ resourceLimits: ClusterResourceLimitsView }> {
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

    async revealCredentials(input: { teamId: string; teamClusterId: string; userId: string; password: string }): Promise<{ teamClusterId: string; services: TeamClusterCredentialServicesView }> {
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

        const revealedServices: TeamClusterCredentialServicesView = {
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

    async createRemoteAccessSession(input: { teamId: string; teamClusterId: string; userId: string; password: string; target: TeamClusterRemoteAccessTarget }): Promise<{ session: TeamClusterRemoteAccessSessionView }> {
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

    async listRemoteExplorerEntries(input: { teamId: string; teamClusterId: string; userId: string; sessionId: string; target: TeamClusterRemoteAccessTarget; path: string }): Promise<{
        teamClusterId: string;
        target: TeamClusterRemoteAccessTarget;
        path: string;
        entries: TeamClusterRemoteExplorerEntryView[];
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

    async getRemoteExplorerNode(input: { teamId: string; teamClusterId: string; userId: string; sessionId: string; target: TeamClusterRemoteAccessTarget; path: string }): Promise<{
        teamClusterId: string;
        target: TeamClusterRemoteAccessTarget;
        node: TeamClusterRemoteExplorerNodeView;
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

    async downloadRemoteExplorerObject(input: { teamId: string; teamClusterId: string; userId: string; sessionId: string; target: TeamClusterRemoteAccessTarget; path: string }): Promise<{
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
        teamCluster?: TeamClusterView;
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

        await this.#lifecycleService.deleteTeamCluster(toTeamClusterLike(doc));

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

    async processHealthcheck(input: { teamClusterId: string; enrollmentToken: string; installedVersion?: string }): Promise<{ teamCluster: TeamClusterView; daemonPassword: string }> {
        try {
            return await this.#lifecycleService.processHealthcheck(input.teamClusterId, input.enrollmentToken, input.installedVersion);
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to process team cluster healthcheck');
        }
    }

    async generateInstallManifest(input: { teamClusterId: string; daemonPassword: string; installRoot: string; ports: TeamClusterInstallManifestPortsView }): Promise<{ manifest: TeamClusterInstallManifestView }> {
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
        metrics?: TeamClusterHeartbeatMetricsInput;
    }): Promise<{ teamCluster: TeamClusterView }> {
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

    async updateLifecycle(input: { teamClusterId: string; daemonPassword: string; status: TeamClusterStatus; installedVersion?: string }): Promise<{ teamCluster: TeamClusterView }> {
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

    async processDaemonJobCompletion(input: ProcessDaemonJobCompletionInput): Promise<ProcessDaemonJobCompletionOutput> {
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

    async processDaemonSceneArtifactUpsert(input: ProcessDaemonSceneArtifactUpsertInput): Promise<ProcessDaemonSceneArtifactUpsertOutput> {
        try {
            const entries = await this.#prepareSceneArtifactUpsertEntries([input]);
            await this.#upsertSceneArtifactsByObjectName(entries);
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

    async processDaemonSceneArtifactUpsertBatch(inputs: ProcessDaemonSceneArtifactUpsertInput[]): Promise<ProcessDaemonSceneArtifactUpsertOutput> {
        try {
            const entries = await this.#prepareSceneArtifactUpsertEntries(inputs);
            await this.#upsertSceneArtifactsByObjectName(entries);
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

    async #preflightRemoteExplorerAccess(input: { teamId: string; teamClusterId: string; sessionId: string; target: TeamClusterRemoteAccessTarget; userId: string }): Promise<{ teamClusterId: string; target: TeamClusterRemoteAccessTarget }> {
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
            await this.#demoDeploymentService.teardownDemoStack(toTeamClusterLike(teamCluster));
            await this.#lifecycleService.deleteTeamCluster(toTeamClusterLike(teamCluster));
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

    #deriveRemoteExplorerFallbackFilename(target: TeamClusterRemoteAccessTarget, path: string): string {
        const lastSegment = path.split('/').filter(Boolean).pop() ?? 'download';

        if (target === TeamClusterRemoteAccessTarget.MongoDocuments) {
            return `${lastSegment}.json`;
        }
        if (target === TeamClusterRemoteAccessTarget.RedisData) {
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

    #presentTeamCluster(doc: TeamClusterDocument, options: { activeTransfers?: ClusterTransferJobView[] } = {}): TeamClusterView {
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

    #presentQueueConcurrency(queueConcurrency: TeamClusterQueueConcurrencyProps): TeamClusterQueueConcurrencyView {
        return {
            analysis: queueConcurrency.analysis,
            rasterizer: queueConcurrency.rasterizer,
            glbPreprocessing: queueConcurrency.glbPreprocessing,
            artifactUpload: queueConcurrency.artifactUpload,
            pluginWarmup: queueConcurrency.pluginWarmup
        };
    }

    #presentQueueScopeLimits(queueScopeLimits: TeamClusterQueueScopeLimitsProps): TeamClusterQueueScopeLimitsView {
        return {
            analysisProcessing: { maxRunningPerTrajectory: queueScopeLimits.analysisProcessing.maxRunningPerTrajectory },
            artifactUpload: { maxRunningPerTrajectory: queueScopeLimits.artifactUpload.maxRunningPerTrajectory },
            trajectoryRasterization: { maxRunningPerTrajectory: queueScopeLimits.trajectoryRasterization.maxRunningPerTrajectory },
            trajectoryGlbConversion: { maxRunningPerTrajectory: queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory }
        };
    }

    #presentClusterTransferJob(doc: ClusterTransferJobDocument): ClusterTransferJobView {
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

    #presentClusterTransferJobEntity(job: ClusterTransferJob): ClusterTransferJobView {
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

    #isAnalysisJobStatusInput(input: ProcessDaemonJobCompletionInput): input is ProcessDaemonAnalysisJobStatusInput {
        return 'analysisId' in input && 'name' in input && 'status' in input && !('success' in input);
    }

    #isAnalysisStageStatusInput(input: ProcessDaemonJobCompletionInput): input is ProcessDaemonAnalysisStageStatusInput {
        return 'analysisId' in input
            && 'name' in input
            && 'stageKey' in input
            && 'stageStatus' in input
            && 'stageType' in input;
    }

    #isAnalysisJobCompletionInput(input: ProcessDaemonJobCompletionInput): input is ProcessDaemonAnalysisJobCompletionInput {
        return 'analysisId' in input && 'name' in input && 'success' in input && !this.#hasJobStatusFields(input);
    }

    #isGlbJobStatusInput(input: ProcessDaemonJobCompletionInput): input is ValidProcessDaemonGlbJobStatusInput {
        return this.#hasJobStatusFields(input)
            && !this.#hasAnalysisJobCompletionFields(input)
            && this.#isGlbJobId(input.jobId)
            && this.#isValidJobStatus(input.status);
    }

    #isArtifactUploadJobStatusInput(input: ProcessDaemonJobCompletionInput): input is ValidProcessDaemonArtifactUploadJobStatusInput {
        return this.#hasJobStatusFields(input)
            && !this.#hasAnalysisJobCompletionFields(input)
            && this.#isArtifactUploadJobId(input.jobId)
            && this.#isValidArtifactUploadJobStatus(input.status);
    }

    #isRasterJobStatusInput(input: ProcessDaemonJobCompletionInput): input is ValidProcessDaemonRasterJobStatusInput {
        return this.#hasJobStatusFields(input)
            && !this.#hasAnalysisJobCompletionFields(input)
            && !this.#isGlbJobId(input.jobId)
            && !this.#isArtifactUploadJobId(input.jobId)
            && this.#isValidJobStatus(input.status);
    }

    #hasAnalysisJobCompletionFields(input: ProcessDaemonJobCompletionInput): boolean {
        return 'name' in input || 'success' in input;
    }

    #hasJobStatusFields(input: ProcessDaemonJobCompletionInput): input is ProcessDaemonRasterJobStatusInput {
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
            const analysis = await AnalysisModel.findById(analysisId);
            if (!analysis) {
                return;
            }

            const expectedArtifacts = this.#updateExpectedArtifacts(analysis.expectedArtifacts ?? [], group);
            const artifactStatus = expectedArtifacts.length > 0
                && expectedArtifacts.every((artifact) => artifact.status === 'ready')
                ? 'ready'
                : (analysis.artifactStatus ?? 'uploading');

            const updatedAnalysis = await AnalysisModel.findByIdAndUpdate(
                analysisId,
                { $set: { expectedArtifacts, artifactStatus } },
                { new: true }
            );
            if (!updatedAnalysis) {
                return;
            }

            await this.#eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.AnalysisStageChanged, {
                analysisId,
                teamId: group[0]!.teamId,
                trajectoryId: updatedAnalysis.trajectory.toString(),
                artifactStatus: updatedAnalysis.artifactStatus,
                expectedArtifacts: updatedAnalysis.expectedArtifacts,
                stages: updatedAnalysis.stages,
                childAnalyses: updatedAnalysis.childAnalyses
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

    async #prepareSceneArtifactUpsertEntries(inputs: ProcessDaemonSceneArtifactUpsertInput[]): Promise<PreparedSceneArtifactUpsertEntry[]> {
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
                const trajectory = await this.#findTrajectoryById(trajectoryId);
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
                const analysis = await AnalysisModel.findById(analysisId);
                return [analysisId, analysis] as const;
            })
        );
        const analysisById = new Map(analyses);

        return inputs.map((input) => {
            const trajectory = trajectoryById.get(input.trajectory);
            if (!trajectory) {
                throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND', 'Trajectory not found');
            }

            const trajectoryStorageClusterId = trajectory.props.storageClusterId;
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

                if (analysis.trajectory.toString() !== trajectory._id) {
                    throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH', 'Analysis does not belong to the provided trajectory');
                }

                if (analysis.team.toString() !== trajectory.props.team) {
                    throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH', 'Analysis ownership does not match its trajectory');
                }

                const analysisStorageClusterId = resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId?.toString() });
                if (!analysisStorageClusterId) {
                    throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_ANALYSIS_STORAGE_CLUSTER_REQUIRED', 'Analysis storage cluster is required before accepting scene artifacts');
                }

                if (input.storageClusterId !== analysisStorageClusterId) {
                    throw ApplicationError.forbidden('TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH', 'Reported storage cluster does not match the analysis storage cluster');
                }

                if (input.sourceType === 'plugin-exposure') {
                    const analysisComputeClusterId = resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() });
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

                if (input.plugin && input.plugin !== analysis.plugin.toString()) {
                    throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH', 'Payload plugin does not match persisted analysis ownership');
                }

                sanitizedAnalysisId = analysis._id.toString();
                sanitizedPluginId = analysis.plugin.toString();
                sanitizedStorageClusterId = analysisStorageClusterId;
            }

            if (!isReporterAuthorized) {
                throw ApplicationError.forbidden('TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH', 'Trajectory storage does not belong to the authenticated team cluster');
            }

            return {
                objectName: input.objectName,
                teamId: trajectory.props.team,
                data: {
                    trajectory: trajectory._id,
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
