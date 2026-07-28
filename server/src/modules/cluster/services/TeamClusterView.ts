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
import type { TeamCluster } from '@modules/cluster/contracts/domain/team-cluster';
import type {
    ClusterTransferJobCursor,
    ClusterTransferJobReason,
    ClusterTransferJobState,
    ClusterTransferJobStats
} from '@volt/contracts/modules/cluster/domain';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS } from '@modules/cluster/services/TeamClusterFactory';

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

export interface TeamClusterServiceView {
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

export interface TeamClusterQueueScopeLimitView {
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
