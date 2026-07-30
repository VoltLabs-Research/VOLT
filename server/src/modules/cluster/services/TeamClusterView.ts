import type {
    TeamClusterDaemonServiceProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterServiceProps,
    TeamClusterServicesProps,
    TeamClusterStatus
} from '@shared/contracts/types/TeamCluster';
import type {
    StoragePlacementBucketRef,
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import type {
    ClusterTransferJobCursor,
    ClusterTransferJobReason,
    ClusterTransferJobState,
    ClusterTransferJobStats
} from '@volt/contracts/modules/cluster/domain';
import { createDefaultTeamClusterQueueScopeLimits, DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS } from '@modules/cluster/services/TeamClusterFactory';
import type TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import type ClusterTransferJobEntity from '@modules/cluster/models/ClusterTransferJob';
import type { ClusterTransferJob } from '@modules/cluster/contracts/cluster-transfer-job';

export interface ClusterTransferJobView {
    _id: string;
    team: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    sourceClusterId: string;
    destinationClusterId: string;
    buckets: StoragePlacementBucketRef[];
    state: ClusterTransferJobState;
    reason: ClusterTransferJobReason;
    cleanupSource: boolean;
    requestedBy: string;
    cursor: ClusterTransferJobCursor;
    stats: ClusterTransferJobStats;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface TeamClusterServiceView {
    port: number | null;
}

export interface TeamClusterServicesView {
    minio: TeamClusterServiceView;
    redis: TeamClusterServiceView;
    mongodb: TeamClusterServiceView;
    daemon: TeamClusterServiceView;
}

export interface TeamClusterCredentialServiceView extends TeamClusterServiceView {
    username: string;
    password: string;
}

export interface TeamClusterDaemonCredentialServiceView extends TeamClusterServiceView {
    password: string;
}

export interface TeamClusterCredentialServicesView {
    minio: TeamClusterCredentialServiceView;
    redis: TeamClusterCredentialServiceView;
    mongodb: TeamClusterCredentialServiceView;
    daemon: TeamClusterDaemonCredentialServiceView;
}

export interface TeamClusterQueueConcurrencyView {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

interface TeamClusterQueueScopeLimitView {
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsView {
    analysisProcessing: TeamClusterQueueScopeLimitView;
    artifactUpload: TeamClusterQueueScopeLimitView;
    trajectoryRasterization: TeamClusterQueueScopeLimitView;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitView;
}

export interface TeamClusterRuntimeRoleConfigView {
    desiredRole: TeamClusterRuntimeRoleConfigProps['desiredRole'];
    effectiveRole: TeamClusterRuntimeRoleConfigProps['effectiveRole'];
    runtimeVersion: number;
    draining: {
        compute: boolean;
        storage: boolean;
    };
    lastAppliedAt?: Date | null;
}

export interface TeamClusterEffectiveCapabilitiesView {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
}

export interface TeamClusterView {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesView;
    queueConcurrency: TeamClusterQueueConcurrencyView;
    queueScopeLimits: TeamClusterQueueScopeLimitsView;
    roleConfig: TeamClusterRuntimeRoleConfigView;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesView;
    activeTransfers?: ClusterTransferJobView[];
    isDemo: boolean;
    demoExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const toServiceView = (service: TeamClusterServiceProps | TeamClusterDaemonServiceProps): TeamClusterServiceView => {
    return {
        port: service.port
    };
};

export const toTeamClusterQueueConcurrencyView = (
    queueConcurrency: TeamClusterQueueConcurrencyProps
): TeamClusterQueueConcurrencyView => ({
    analysis: queueConcurrency.analysis,
    rasterizer: queueConcurrency.rasterizer,
    glbPreprocessing: queueConcurrency.glbPreprocessing,
    artifactUpload: queueConcurrency.artifactUpload,
    pluginWarmup: queueConcurrency.pluginWarmup
});

export const toTeamClusterQueueScopeLimitsView = (
    queueScopeLimits: TeamClusterQueueScopeLimitsProps
): TeamClusterQueueScopeLimitsView => ({
    analysisProcessing: {
        maxRunningPerTrajectory: queueScopeLimits.analysisProcessing.maxRunningPerTrajectory
    },
    artifactUpload: {
        maxRunningPerTrajectory: queueScopeLimits.artifactUpload.maxRunningPerTrajectory
    },
    trajectoryRasterization: {
        maxRunningPerTrajectory: queueScopeLimits.trajectoryRasterization.maxRunningPerTrajectory
    },
    trajectoryGlbConversion: {
        maxRunningPerTrajectory: queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory
    }
});

export const toTeamClusterView = (
    teamCluster: TeamCluster,
    options: {
        activeTransfers?: ClusterTransferJobView[];
    } = {}
): TeamClusterView => {
    const services: TeamClusterServicesProps = teamCluster.props.services;
    const roleConfig = teamCluster.props.roleConfig;
    const effectiveCapabilities = teamCluster.effectiveCapabilities;
    const activeTransfers = options.activeTransfers?.map((job) => ({
        ...job,
        buckets: job.buckets.map((bucketRef) => ({
            bucket: bucketRef.bucket,
            prefix: bucketRef.prefix
        })),
        cursor: {
            bucketIndex: job.cursor.bucketIndex,
            lastObjectKey: job.cursor.lastObjectKey
        },
        stats: {
            copiedObjects: job.stats.copiedObjects,
            copiedBytes: job.stats.copiedBytes,
            verifiedObjects: job.stats.verifiedObjects,
            verifiedBytes: job.stats.verifiedBytes,
            deletedObjects: job.stats.deletedObjects
        }
    }));

    return {
        _id: teamCluster._id,
        name: teamCluster.props.name,
        team: teamCluster.props.team,
        createdBy: teamCluster.props.createdBy,
        status: teamCluster.props.status,
        installedVersion: teamCluster.props.installedVersion,
        lastHeartbeatAt: teamCluster.props.lastHeartbeatAt,
        lastDisconnectAt: teamCluster.props.lastDisconnectAt,
        services: {
            minio: toServiceView(services.minio),
            redis: toServiceView(services.redis),
            mongodb: toServiceView(services.mongodb),
            daemon: toServiceView(services.daemon)
        },
        queueConcurrency: toTeamClusterQueueConcurrencyView(teamCluster.props.queueConcurrency),
        queueScopeLimits: toTeamClusterQueueScopeLimitsView(
            teamCluster.props.queueScopeLimits ?? DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS
        ),
        roleConfig: {
            desiredRole: roleConfig.desiredRole,
            effectiveRole: roleConfig.effectiveRole,
            runtimeVersion: roleConfig.runtimeVersion,
            draining: {
                ...roleConfig.draining
            },
            lastAppliedAt: roleConfig.lastAppliedAt ?? null
        },
        effectiveCapabilities: {
            ...effectiveCapabilities
        },
        ...(activeTransfers ? { activeTransfers } : {}),
        isDemo: teamCluster.props.isDemo,
        demoExpiresAt: teamCluster.props.demoExpiresAt,
        createdAt: teamCluster.props.createdAt,
        updatedAt: teamCluster.props.updatedAt
    };
};


export const toTeamClusterViewFromEntity = (
    entity: TeamClusterEntity,
    options: {
        activeTransfers?: ClusterTransferJobView[];
    } = {}
): TeamClusterView => {
    const services = entity.services;
    const roleConfig = entity.roleConfig;
    const activeTransfers = options.activeTransfers;

    return {
        _id: entity.id,
        name: entity.name,
        team: entity.team,
        createdBy: entity.createdBy,
        status: entity.status,
        installedVersion: entity.installedVersion,
        lastHeartbeatAt: entity.lastHeartbeatAt,
        lastDisconnectAt: entity.lastDisconnectAt,
        services: {
            minio: toServiceView(services.minio),
            redis: toServiceView(services.redis),
            mongodb: toServiceView(services.mongodb),
            daemon: toServiceView(services.daemon)
        },
        queueConcurrency: toTeamClusterQueueConcurrencyView(entity.queueConcurrency),
        queueScopeLimits: toTeamClusterQueueScopeLimitsView(
            entity.queueScopeLimits ?? createDefaultTeamClusterQueueScopeLimits()
        ),
        roleConfig: {
            desiredRole: roleConfig.desiredRole,
            effectiveRole: roleConfig.effectiveRole,
            runtimeVersion: roleConfig.runtimeVersion,
            draining: {
                ...roleConfig.draining
            },
            lastAppliedAt: roleConfig.lastAppliedAt ?? null
        },
        effectiveCapabilities: {
            ...entity.effectiveCapabilities
        },
        ...(activeTransfers ? { activeTransfers } : {}),
        isDemo: entity.isDemo,
        demoExpiresAt: entity.demoExpiresAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
    };
};

const toBucketRefViews = (buckets: StoragePlacementBucketRef[]): StoragePlacementBucketRef[] => (
    buckets.map((bucketRef) => ({
        bucket: bucketRef.bucket,
        prefix: bucketRef.prefix
    }))
);

export const toClusterTransferJobViewFromEntity = (
    entity: ClusterTransferJobEntity
): ClusterTransferJobView => ({
    _id: entity.id,
    team: entity.team,
    scopeType: entity.scopeType,
    scopeId: entity.scopeId,
    sourceClusterId: entity.sourceClusterId,
    destinationClusterId: entity.destinationClusterId,
    buckets: toBucketRefViews(entity.buckets),
    state: entity.state,
    reason: entity.reason,
    cleanupSource: entity.cleanupSource,
    requestedBy: entity.requestedBy,
    cursor: {
        bucketIndex: entity.cursor.bucketIndex,
        lastObjectKey: entity.cursor.lastObjectKey
    },
    stats: {
        copiedObjects: entity.stats.copiedObjects,
        copiedBytes: entity.stats.copiedBytes,
        verifiedObjects: entity.stats.verifiedObjects,
        verifiedBytes: entity.stats.verifiedBytes,
        deletedObjects: entity.stats.deletedObjects
    },
    errorCode: entity.errorCode,
    errorMessage: entity.errorMessage,
    startedAt: entity.startedAt,
    finishedAt: entity.finishedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
});

export const toClusterTransferJobViewFromDomain = (job: ClusterTransferJob): ClusterTransferJobView => ({
    _id: job.id,
    team: job.props.team,
    scopeType: job.props.scopeType,
    scopeId: job.props.scopeId,
    sourceClusterId: job.props.sourceClusterId,
    destinationClusterId: job.props.destinationClusterId,
    buckets: toBucketRefViews(job.props.buckets),
    state: job.props.state,
    reason: job.props.reason,
    cleanupSource: job.props.cleanupSource,
    requestedBy: job.props.requestedBy,
    cursor: {
        bucketIndex: job.props.cursor.bucketIndex,
        lastObjectKey: job.props.cursor.lastObjectKey
    },
    stats: {
        ...job.props.stats
    },
    errorCode: job.props.errorCode,
    errorMessage: job.props.errorMessage,
    startedAt: job.props.startedAt,
    finishedAt: job.props.finishedAt,
    createdAt: job.props.createdAt,
    updatedAt: job.props.updatedAt
});
