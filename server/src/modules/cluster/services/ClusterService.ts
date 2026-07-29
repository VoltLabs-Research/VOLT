import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import { ErrorCodes } from '@core/constants/error-codes';
import User from '@modules/auth/models/User';
import BcryptPasswordHasher from '@modules/auth/services/BcryptPasswordHasher';
import Analysis from '@modules/analysis/models/Analysis';
import { AnalysisArtifactStatus } from '@modules/analysis/contracts/domain/analysis';
import Trajectory from '@modules/trajectory/models/Trajectory';
import SceneArtifact from '@modules/trajectory/models/SceneArtifact';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRedisRepository';
import type { SystemStatus } from '@modules/system/services/SystemMetrics';
import type { TrajectoryLike } from '@shared/contracts/types';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@shared/application/utilities/cluster-location';
import type { TeamClusterDaemonSemanticCommandResult } from '@modules/cluster/services/TeamClusterDaemonClient';
import type { SceneArtifactBatchUpsertedArtifact } from '@shared/contracts/events';
import type {
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
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { ILike, In, Not, QueryFailedError } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/domain/team-cluster';
import ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import {
    isAnalysisJobCompletionInput,
    isAnalysisJobStatusInput,
    isAnalysisStageStatusInput,
    isArtifactUploadJobStatusInput,
    isGlbJobStatusInput,
    isRasterJobStatusInput
} from '@modules/cluster/contracts/domain/daemon-job-completion';
import type {
    ProcessDaemonJobCompletionInput,
    ProcessDaemonJobCompletionOutput
} from '@modules/cluster/contracts/domain/daemon-job-completion';
import { TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import type {
    TeamClusterProps,
    TeamClusterRole,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';
import {
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY
} from '@modules/cluster/services/TeamClusterFactory';
import {
    ClusterTransferJobState as ClusterTransferJobStateColumn,
    type ClusterTransferJob
} from '@modules/cluster/contracts/domain/cluster-transfer-job';
import type { ClusterTransferJobState } from '@volt/contracts/modules/cluster/domain';
import type { StoragePlacement } from '@modules/cluster/contracts/domain/storage-placement';

import type {
    TeamClusterView,
    TeamClusterQueueConcurrencyView,
    TeamClusterCredentialServicesView
} from '@modules/cluster/services/TeamClusterView';
import type { ClusterTransferJobView } from '@modules/cluster/services/TeamClusterView';
import {
    toClusterTransferJobViewFromDomain,
    toClusterTransferJobViewFromEntity,
    toTeamClusterQueueConcurrencyView,
    toTeamClusterQueueScopeLimitsView,
    toTeamClusterViewFromEntity
} from '@modules/cluster/services/TeamClusterView';
import {
    TeamClusterRemoteAccessTarget,
    type TeamClusterRemoteAccessSessionView,
    type TeamClusterRemoteExplorerEntryView,
    type TeamClusterRemoteExplorerNodeView
} from '@modules/cluster/services/TeamClusterRemoteAccess';
import type {
    TeamClusterInstallManifestView,
    TeamClusterInstallManifestPortsView
} from '@modules/cluster/services/TeamClusterInstallManifest';
import type { TeamClusterHeartbeatMetricsInput } from '@modules/cluster/socket/TeamClusterSocketProtocol';

import clusterTransferCoordinator from '@modules/cluster/services/ClusterTransferCoordinator';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import clusterTransferRunner from '@modules/cluster/services/ClusterTransferRunner';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import demoClusterDeploymentService from '@modules/cluster/services/DemoClusterDeploymentService';
import type { DemoClusterPlaintextCredentials } from '@modules/cluster/services/DemoClusterDeploymentService';
import TeamClusterCredentialService from '@modules/cluster/services/TeamClusterCredentialService';
import teamClusterInstallManifestService from '@modules/cluster/services/TeamClusterInstallManifestService';
import teamClusterRemoteAccessSessionService from '@modules/cluster/services/TeamClusterRemoteAccessSessionService';
import remoteExplorerDaemonGateway from '@modules/cluster/services/RemoteExplorerDaemonGateway';
import daemonAnalysisCompletionService from '@modules/cluster/services/DaemonAnalysisCompletionService';

import {
    createEnrollmentToken,
    hashEnrollmentToken
} from '@modules/cluster/services/TeamClusterCredentialService';
import {
    buildTeamClusterProps,
    createServiceCredentials,
    createDaemonPassword,
    encryptTeamClusterServices
} from '@modules/cluster/services/TeamClusterFactory';
import { buildManualTeamClusterUninstallCommand } from '@modules/cluster/services/TeamClusterInstallRoot';
import { assertConfirmedPassword } from '@modules/cluster/services/TeamClusterCredentialService';

import type { PaginatedResult } from '@shared/domain/port/persistence';

const MB_PER_GB = 1024;
const DEMO_CLUSTER_TTL_MINUTES = readNumberEnv('DEMO_CLUSTER_TTL_MINUTES', 30);
const POSTGRES_UNIQUE_VIOLATION = '23505';
const SQLITE_UNIQUE_VIOLATION = 'SQLITE_CONSTRAINT_UNIQUE';

const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobStateColumn[] = [
    ClusterTransferJobStateColumn.Queued,
    ClusterTransferJobStateColumn.Freezing,
    ClusterTransferJobStateColumn.Copying,
    ClusterTransferJobStateColumn.Verifying,
    ClusterTransferJobStateColumn.Switching,
    ClusterTransferJobStateColumn.Cleaning
];

const NON_ACTIVE_DEMO_STATUSES: TeamClusterStatus[] = [
    TeamClusterStatus.Deleting,
    TeamClusterStatus.DeleteFailed
];

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const WAITING_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.WaitingForConnection,
    TeamClusterStatus.HealthcheckReceived,
    TeamClusterStatus.PreparingEnvironment,
    TeamClusterStatus.Disconnected
]);

const activeDemoFilter = (teamId: string): FindOptionsWhere<TeamClusterEntity> => ({
    team: teamId,
    isDemo: true,
    status: Not(In(NON_ACTIVE_DEMO_STATUSES))
});

const findActiveDemo = (teamId: string): Promise<TeamClusterEntity | null> => TeamClusterEntity.findOneBy(activeDemoFilter(teamId));

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
        findById: (userId: string) => User.findOneBy({ id: userId }),
        findByIdWithPassword: (userId: string) => User.findOneBy({ id: userId })
    };
    #passwordHasher = new BcryptPasswordHasher();
    #systemMetricsRepository = systemMetricsRepository;

        #teamClusterDaemonClient = teamClusterDaemonClient;

        #eventBus = eventBus;

    #toTrajectoryLike(trajectory: Trajectory): TrajectoryLike {
        return {
            _id: trajectory.id,
            props: {
                name: trajectory.name,
                team: trajectory.team,
                folder: trajectory.folder,
                storageClusterId: trajectory.storageClusterId,
                createdBy: trajectory.createdBy,
                status: trajectory.status,
                isPublic: trajectory.isPublic,
                rasterSceneViews: trajectory.rasterSceneViews,
                hasPreview: trajectory.hasPreview,
                stats: trajectory.stats,
                updatedAt: trajectory.updatedAt,
                createdAt: trajectory.createdAt
            }
        };
    }

    async #findTrajectoryById(trajectoryId: string): Promise<TrajectoryLike | null> {
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        return trajectory ? this.#toTrajectoryLike(trajectory) : null;
    }

    async #upsertSceneArtifactsByObjectName(entries: PreparedSceneArtifactUpsertEntry[]): Promise<void> {
        if (!entries.length) {
            return;
        }

        for (const entry of entries) {
            const patch = {
                trajectory: entry.data.trajectory,
                storageClusterId: entry.data.storageClusterId,
                analysis: entry.data.analysis ?? null,
                plugin: entry.data.plugin ?? null,
                sourceType: entry.data.sourceType,
                timestep: entry.data.timestep,
                params: entry.data.params,
                displayName: entry.data.displayName,
                status: entry.data.status,
                storageBucket: entry.data.storageBucket,
                ...(entry.data.metadata === undefined ? {} : { metadata: entry.data.metadata }),
                objectName: entry.objectName
            };

            try {
                const existing = await SceneArtifact.findOneBy({ objectName: entry.objectName });
                if (existing) {
                    await Object.assign(existing, patch).save();
                    continue;
                }

                await SceneArtifact.create({ ...patch }).save();
            } catch (error: unknown) {
                logger.warn(`[ClusterService.upsertSceneArtifactsByObjectName] Failed to upsert scene artifact objectName=${entry.objectName} error=${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    #lifecycleService = teamClusterLifecycleService;
    #demoDeploymentService = demoClusterDeploymentService;
    #credentialService = new TeamClusterCredentialService();
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

        const existingDemo = await findActiveDemo(input.teamId);

        const enrollmentToken = createEnrollmentToken();
        const encryptedServices = await encryptTeamClusterServices(this.#credentialService, {
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

        let created: TeamClusterEntity;
        try {
            created = await TeamClusterEntity.create({ ...this.#toTeamClusterEntityInput(teamClusterProps) }).save();
        } catch (error: unknown) {
            if (this.#isUniqueViolation(error)) {
                throw ApplicationError.conflict('TeamCluster::AlreadyExists', 'A team cluster with this name already exists');
            }
            throw ApplicationError.internalServerError('Failed to create team cluster');
        }

        logger.info(`Team cluster created teamClusterId=${created.id} teamId=${input.teamId} userId=${input.userId}`);

        if (existingDemo) {
            void (async () => {
                try {
                    await this.#lifecycleService.markDeleting(existingDemo.id);
                } catch (error: unknown) {
                    logger.warn(`[ClusterService.create] markDeleting on existing demo failed teamClusterId=${existingDemo.id} error=${(error as Error).message}`);
                }
                try {
                    await this.#demoDeploymentService.teardownDemoStack(toTeamClusterLike(existingDemo));
                    const refreshed = await TeamClusterEntity.findOneBy({ id: existingDemo.id });
                    if (refreshed) {
                        await this.#lifecycleService.deleteTeamCluster(toTeamClusterLike(refreshed));
                    }
                    logger.info(`[ClusterService.create] Auto-removed demo after real cluster creation teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
                } catch (error: unknown) {
                    logger.error(error, `[ClusterService.create] Auto-teardown of demo failed teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
                }
            })();
        }

        return {
            teamCluster: toTeamClusterViewFromEntity(created),
            enrollmentToken
        };
    }

    async listByTeamId(input: { teamId: string; page?: number; limit?: number; search?: string }): Promise<PaginatedResult<TeamClusterView>> {
        const baseWhere: FindOptionsWhere<TeamClusterEntity> = { team: input.teamId };

        const search = input.search?.trim();
        const containsSearch = search ? ILike(`%${escapeLikePattern(search)}%`) : undefined;
        const where: FindOptionsWhere<TeamClusterEntity> | FindOptionsWhere<TeamClusterEntity>[] = containsSearch
            ? [
                {
                    ...baseWhere,
                    name: containsSearch
                },
                {
                    ...baseWhere,
                    installedVersion: containsSearch
                },
                {
                    ...baseWhere,
                    id: containsSearch
                }
            ]
            : baseWhere;

        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: 100 });

        const [entities, total] = await TeamClusterEntity.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        const clusterIds = entities.map((entity) => entity.id);
        const clusterIdSet = new Set(clusterIds);
        const activeTransfersByClusterId = new Map<string, ClusterTransferJobView[]>();
        const normalizedClusterIds = [...new Set(clusterIds.filter(Boolean))];

        if (normalizedClusterIds.length > 0) {
            const activeTransferJobs = await ClusterTransferJobEntity.find({
                where: [
                    {
                        team: input.teamId,
                        state: In(OPEN_TRANSFER_JOB_STATES),
                        sourceClusterId: In(normalizedClusterIds)
                    },
                    {
                        team: input.teamId,
                        state: In(OPEN_TRANSFER_JOB_STATES),
                        destinationClusterId: In(normalizedClusterIds)
                    }
                ],
                order: {
                    updatedAt: 'DESC',
                    createdAt: 'DESC'
                }
            });

            for (const job of activeTransferJobs) {
                const jobView = toClusterTransferJobViewFromEntity(job);

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

        const data = entities.map((entity) => toTeamClusterViewFromEntity(entity, {
            activeTransfers: activeTransfersByClusterId.get(entity.id) ?? []
        }));

        return paginate([data, total], pageRequest);
    }

    async provisionDemo(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterView }> {
        const existingDemo = await findActiveDemo(input.teamId);
        if (existingDemo) {
            logger.info(`[ClusterService.provisionDemo] Returning existing demo teamClusterId=${existingDemo.id} teamId=${input.teamId}`);
            return { teamCluster: toTeamClusterViewFromEntity(existingDemo) };
        }

        const enrollmentToken = createEnrollmentToken();
        const credentials = this.#buildDemoPlaintextCredentials(enrollmentToken);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + DEMO_CLUSTER_TTL_MINUTES * 60_000);
        const encryptedServices = await encryptTeamClusterServices(this.#credentialService, {
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

        let created: TeamClusterEntity;
        try {
            created = await TeamClusterEntity.create({ ...this.#toTeamClusterEntityInput(teamClusterProps) }).save();
        } catch (error: unknown) {
            if (this.#isUniqueViolation(error)) {
                const fallback = await findActiveDemo(input.teamId);
                if (fallback) {
                    return { teamCluster: toTeamClusterViewFromEntity(fallback) };
                }
            }
            logger.error(error, `[ClusterService.provisionDemo] Failed to persist demo cluster teamId=${input.teamId}`);
            throw ApplicationError.internalServerError('Failed to provision demo cluster');
        }

        logger.info(`[ClusterService.provisionDemo] Demo cluster persisted teamClusterId=${created.id} teamId=${input.teamId} expiresAt=${expiresAt.toISOString()}`);

        void this.#demoDeploymentService.deployDemoStack(toTeamClusterLike(created), credentials).catch((error: unknown) => {
            logger.error(error, `[ClusterService.provisionDemo] Demo stack deploy failed teamClusterId=${created.id} teamId=${input.teamId}`);
        });

        return { teamCluster: toTeamClusterViewFromEntity(created) };
    }

    async deleteDemo(input: { teamId: string; userId: string }): Promise<{ teardownScheduled: boolean }> {
        const demo = await findActiveDemo(input.teamId);
        if (!demo) {
            return { teardownScheduled: false };
        }

        try {
            await this.#lifecycleService.markDeleting(demo.id);
        } catch (error: unknown) {
            logger.warn(`[ClusterService.deleteDemo] markDeleting failed teamClusterId=${demo.id} error=${(error as Error).message}`);
        }

        const refreshed = await TeamClusterEntity.findOneBy({ id: demo.id });
        const target = refreshed ?? demo;

        void (async () => {
            try {
                await this.#demoDeploymentService.teardownDemoStack(toTeamClusterLike(target));
                await this.#lifecycleService.deleteTeamCluster(toTeamClusterLike(target));
                logger.info(`[ClusterService.deleteDemo] Demo deleted teamClusterId=${target.id} teamId=${input.teamId}`);
            } catch (error: unknown) {
                logger.error(error, `[ClusterService.deleteDemo] Demo teardown failed teamClusterId=${target.id} teamId=${input.teamId}`);
            }
        })();

        return { teardownScheduled: true };
    }

    async getDemoStatus(input: { teamId: string; userId: string }): Promise<{ teamCluster: TeamClusterView | null; remainingMs: number | null; hasActiveDemo: boolean }> {
        const demo = await findActiveDemo(input.teamId);
        if (!demo) {
            return {
                teamCluster: null,
                remainingMs: null,
                hasActiveDemo: false
            };
        }

        const expiresAt = demo.demoExpiresAt;
        if (!expiresAt) {
            return {
                teamCluster: toTeamClusterViewFromEntity(demo),
                remainingMs: null,
                hasActiveDemo: true
            };
        }

        const now = Date.now();
        const remainingMs = expiresAt.getTime() - now;

        if (remainingMs <= 0) {
            void this.#scheduleExpiredDemoCleanup(demo.id, input.teamId);
            return {
                teamCluster: toTeamClusterViewFromEntity(demo),
                remainingMs: 0,
                hasActiveDemo: false
            };
        }

        return {
            teamCluster: toTeamClusterViewFromEntity(demo),
            remainingMs,
            hasActiveDemo: true
        };
    }

    async getById(input: { teamId: string; teamClusterId: string }): Promise<{ teamCluster: TeamClusterView }> {
        const entity = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);
        return { teamCluster: toTeamClusterViewFromEntity(entity) };
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
                    doc.id,
                    ChannelCommands.RuntimeQueuesSnapshot,
                    {},
                    { timeoutClass: 'default' }
                );
                daemonQueues = response.queues ?? [];
                capturedAt = response.capturedAt ?? capturedAt;
            } catch (error: unknown) {
                logger.warn(error, `[ClusterService.getRuntimeSnapshot] daemon snapshot failed teamClusterId=${doc.id}`);
            }
        }

        return {
            capturedAt,
            queueConcurrency: toTeamClusterQueueConcurrencyView(doc.queueConcurrency),
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

        const updated = await Object.assign(doc, {
            queueConcurrency: persistedQueueConcurrency,
            queueScopeLimits: persistedQueueScopeLimits
        }).save();

        this.#lifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));

        if (updated.status === TeamClusterStatus.Connected) {
            try {
                const queueConcurrencyPayload: TeamClusterDaemonQueueConcurrencyApplyPayload = {
                    queueConcurrency: toTeamClusterQueueConcurrencyView(updated.queueConcurrency),
                    queueScopeLimits: toTeamClusterQueueScopeLimitsView(updated.queueScopeLimits)
                };
                const queueConcurrencyCommandResult = await this.#teamClusterDaemonClient.commandWithSemanticResult<{ accepted?: boolean; reason?: string }>(
                    updated.id,
                    ChannelCommands.RuntimeQueueConcurrencyApply,
                    queueConcurrencyPayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (!queueConcurrencyCommandResult.accepted) {
                    logger.warn(`Persisted team cluster queue concurrency but the daemon rejected the live apply request teamClusterId=${updated.id} teamId=${input.teamId} reason=${queueConcurrencyCommandResult.reason} queueConcurrency=${queueConcurrencyPayload.queueConcurrency}`);
                }
            } catch {
                logger.warn(`Persisted team cluster queue concurrency but failed to request live daemon apply teamClusterId=${updated.id} teamId=${input.teamId} queueConcurrency=${updated.queueConcurrency}`);
            }
        }

        return {
            message: 'Queue settings saved.',
            teamCluster: toTeamClusterViewFromEntity(updated)
        };
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

        let updated = await Object.assign(doc, { roleConfig: nextRoleConfig }).save();

        this.#lifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));

        if (updated.status === TeamClusterStatus.Connected) {
            try {
                const rolePayload: TeamClusterDaemonRoleApplyPayload = { roleConfig: updated.roleConfig };
                const liveApplyResult = await this.#teamClusterDaemonClient.commandWithSemanticResult<TeamClusterDaemonRoleApplyResult>(
                    updated.id,
                    ChannelCommands.RuntimeRoleApply,
                    rolePayload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (liveApplyResult.accepted) {
                    const roleResult = liveApplyResult.data;
                    updated = await Object.assign(updated, { roleConfig: roleResult.roleConfig }).save();
                    this.#lifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));
                } else {
                    logger.warn(`Persisted desired role but the daemon rejected the live apply request teamClusterId=${updated.id} teamId=${input.teamId} role=${input.role} reason=${liveApplyResult.reason}`);
                }
            } catch {
                logger.warn(`Persisted desired role but failed to request live daemon role apply teamClusterId=${updated.id} teamId=${input.teamId} role=${input.role}`);
            }
        }

        return {
            message: 'Team cluster role saved.',
            teamCluster: toTeamClusterViewFromEntity(updated)
        };
    }

    async listTransferJobs(input: { teamId: string; teamClusterId: string; page?: number; limit?: number; state?: ClusterTransferJobState }): Promise<PaginatedResult<ClusterTransferJobView>> {
        const teamCluster = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const stateFilter = input.state === undefined
            ? {}
            : { state: input.state as ClusterTransferJobStateColumn };
        const where: FindOptionsWhere<ClusterTransferJobEntity>[] = [
            {
                team: input.teamId,
                sourceClusterId: teamCluster.id,
                ...stateFilter
            },
            {
                team: input.teamId,
                destinationClusterId: teamCluster.id,
                ...stateFilter
            }
        ];

        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: 100 });

        const [entities, total] = await ClusterTransferJobEntity.findAndCount({
            where,
            order: {
                createdAt: 'DESC',
                updatedAt: 'DESC'
            },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([entities.map((entity) => toClusterTransferJobViewFromEntity(entity)), total], pageRequest);
    }

    async createTransferRequest(input: { teamId: string; teamClusterId: string; destinationClusterId: string; authenticatedUserId: string }): Promise<{
        message: string;
        sourceClusterId: string;
        destinationClusterId: string;
        requestedJobs: ClusterTransferJobView[];
    }> {
        const sourceCluster = await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);
        const destinationCluster = await this.#getOwnedTeamCluster(input.destinationClusterId, input.teamId);

        if (sourceCluster.id === destinationCluster.id) {
            throw ApplicationError.conflict('ClusterTransfer::DestinationMustDiffer', 'Destination cluster must be different from the source cluster');
        }

        const sourceCapabilities = sourceCluster.effectiveCapabilities;
        if (sourceCluster.status !== TeamClusterStatus.Connected || !sourceCapabilities.servesStorageReads) {
            throw ApplicationError.conflict('ClusterTransfer::SourceClusterUnavailable', 'Source cluster must be connected and able to serve authoritative storage reads');
        }

        const destinationCapabilities = destinationCluster.effectiveCapabilities;
        if (destinationCluster.status !== TeamClusterStatus.Connected || !destinationCapabilities.acceptsStorageWrites) {
            throw ApplicationError.conflict('ClusterTransfer::DestinationClusterUnavailable', 'Destination cluster must be connected and able to accept storage writes');
        }

        const placements: StoragePlacement[] = await this.#storagePlacementService.resolveTransferPlacementsForCluster(input.teamId, sourceCluster.id);
        if (!placements.length) {
            throw ApplicationError.conflict('ClusterTransfer::NoPlacements', 'This cluster has no authoritative storage placements to transfer');
        }

        const requestedJobs: ClusterTransferJob[] = [];
        for (const placement of placements) {
            requestedJobs.push(await this.#transferCoordinator.requestTransfer({
                teamId: input.teamId,
                scopeType: placement.props.scopeType,
                scopeId: placement.props.scopeId,
                destinationClusterId: destinationCluster.id,
                requestedBy: input.authenticatedUserId
            }));
        }

        this.#transferRunner.kick(Math.min(Math.max(requestedJobs.length, 1), 10));

        return {
            message: requestedJobs.length === 1
                ? 'Queued 1 transfer job for this cluster.'
                : `Queued ${requestedJobs.length} transfer jobs for this cluster.`,
            sourceClusterId: sourceCluster.id,
            destinationClusterId: destinationCluster.id,
            requestedJobs: requestedJobs.map((job) => toClusterTransferJobViewFromDomain(job))
        };
    }

    async getResourceLimits(input: { teamId: string; teamClusterId: string }): Promise<{ resourceLimits: ClusterResourceLimitsView }> {
        await this.#getOwnedTeamCluster(input.teamClusterId, input.teamId);

        const metrics = await this.#systemMetricsRepository.getLatestByClusterId(input.teamClusterId);
        if (!metrics) {
            return {
                resourceLimits: {
                    maxCpus: null,
                    maxMemoryMB: null,
                    status: null,
                    lastUpdatedAt: null
                }
            };
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
        const teamClusterId = doc.id;

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

        return {
            teamClusterId: input.teamClusterId,
            services: revealedServices
        };
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

            return {
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                path: input.path,
                entries
            };
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

            return {
                teamClusterId: preflight.teamClusterId,
                target: preflight.target,
                node
            };
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

        await TeamClusterEntity.update({ id: input.teamClusterId }, { enrollmentTokenHash });

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
            ? buildManualTeamClusterUninstallCommand(doc.id, doc.installRoot)
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

            if (isAnalysisStageStatusInput(input)) {
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

            if (isAnalysisJobStatusInput(input)) {
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

            if (isAnalysisJobCompletionInput(input)) {
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

            if (isGlbJobStatusInput(input)) {
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

            if (isArtifactUploadJobStatusInput(input)) {
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

            if (isRasterJobStatusInput(input)) {
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

    async #getOwnedTeamCluster(teamClusterId: string, teamId: string): Promise<TeamClusterEntity> {
        const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        if (!entity || entity.team !== teamId) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }
        return entity;
    }

    async #getOwnedTeamClusterWithSensitiveData(teamClusterId: string, teamId: string): Promise<TeamClusterEntity> {
        return this.#getOwnedTeamCluster(teamClusterId, teamId);
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

        return {
            teamClusterId: input.teamClusterId,
            target: input.target
        };
    }

    #isUniqueViolation(error: unknown): boolean {
        if (!(error instanceof QueryFailedError)) {
            return false;
        }

        const driverError = error.driverError as { code?: string | number } | undefined;
        const code = driverError?.code ?? (error as unknown as { code?: string | number }).code;

        return String(code) === POSTGRES_UNIQUE_VIOLATION
            || String(code).startsWith(SQLITE_UNIQUE_VIOLATION);
    }

    #toTeamClusterEntityInput(props: TeamClusterProps): Partial<TeamClusterEntity> {
        return {
            name: props.name,
            team: props.team,
            createdBy: props.createdBy,
            status: props.status,
            enrollmentTokenHash: props.enrollmentTokenHash,
            installedVersion: props.installedVersion,
            installRoot: props.installRoot,
            lastHeartbeatAt: props.lastHeartbeatAt,
            lastDisconnectAt: props.lastDisconnectAt,
            services: props.services,
            queueConcurrency: props.queueConcurrency,
            queueScopeLimits: props.queueScopeLimits,
            roleConfig: props.roleConfig,
            isDemo: props.isDemo,
            demoExpiresAt: props.demoExpiresAt
        };
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

        const teamCluster = await TeamClusterEntity.findOneBy({ id: teamClusterId });
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
        return this.#credentialService.decrypt(value);
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
            this.#eventBus.emit('scene-artifact.upserted', group).catch((err) => {
                logger.warn({
                    err,
                    trajectoryId: group.trajectoryId,
                    analysisId: group.analysisId
                },
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
            const analysis = await Analysis.findOneBy({ id: analysisId });
            if (!analysis) {
                return;
            }

            const expectedArtifacts = this.#updateExpectedArtifacts(analysis.expectedArtifacts ?? [], group);
            const artifactStatus = expectedArtifacts.length > 0
                && expectedArtifacts.every((artifact) => artifact.status === 'ready')
                ? AnalysisArtifactStatus.Ready
                : (analysis.artifactStatus ?? AnalysisArtifactStatus.Uploading);

            const updatedAnalysis = await Object.assign(analysis, {
                expectedArtifacts,
                artifactStatus
            }).save();

            await this.#eventBus.emit('analysis.stage.changed', {
                analysisId,
                teamId: group[0]!.teamId,
                trajectoryId: updatedAnalysis.trajectory,
                artifactStatus: updatedAnalysis.artifactStatus,
                expectedArtifacts: updatedAnalysis.expectedArtifacts,
                stages: updatedAnalysis.stages,
                childAnalyses: updatedAnalysis.childAnalyses
            }).catch((err) => {
                logger.warn({
                    err,
                    analysisId
                }, '[ClusterService.processDaemonSceneArtifactUpsert] Failed to publish analysis.stage.changed after artifact upsert');
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
                const analysis = await Analysis.findOneBy({ id: analysisId });
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

                if (analysis.trajectory !== trajectory._id) {
                    throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH', 'Analysis does not belong to the provided trajectory');
                }

                if (analysis.team !== trajectory.props.team) {
                    throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH', 'Analysis ownership does not match its trajectory');
                }

                const analysisStorageClusterId = resolveAnalysisStorageClusterId({ storageClusterId: analysis.storageClusterId ?? undefined });
                if (!analysisStorageClusterId) {
                    throw ApplicationError.conflict('TEAM_CLUSTER_DAEMON_ANALYSIS_STORAGE_CLUSTER_REQUIRED', 'Analysis storage cluster is required before accepting scene artifacts');
                }

                if (input.storageClusterId !== analysisStorageClusterId) {
                    throw ApplicationError.forbidden('TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH', 'Reported storage cluster does not match the analysis storage cluster');
                }

                if (input.sourceType === 'plugin-exposure') {
                    const analysisComputeClusterId = resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined });
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

                if (input.plugin && input.plugin !== analysis.plugin) {
                    throw ApplicationError.badRequest('TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH', 'Payload plugin does not match persisted analysis ownership');
                }

                sanitizedAnalysisId = analysis.id;
                sanitizedPluginId = analysis.plugin;
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
