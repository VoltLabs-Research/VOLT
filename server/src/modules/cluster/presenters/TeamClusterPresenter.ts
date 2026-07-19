import type { TeamCluster } from '@modules/cluster/models/TeamClusterModel';
import { DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS } from '@modules/cluster/utilities/team-cluster-defaults';
import type {
    TeamClusterDaemonServiceProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterServiceProps,
    TeamClusterServicesProps
} from '@shared/contracts/types/TeamCluster';
import type { ClusterTransferJobView } from '@modules/cluster/contracts/ClusterTransferJobView';
import type {
    TeamClusterServiceView,
    TeamClusterQueueConcurrencyView,
    TeamClusterQueueScopeLimitsView,
    TeamClusterView
} from '@modules/cluster/contracts/TeamClusterView';

export type {
    TeamClusterServiceView,
    TeamClusterServicesView,
    TeamClusterCredentialServiceView,
    TeamClusterDaemonCredentialServiceView,
    TeamClusterCredentialServicesView,
    TeamClusterQueueConcurrencyView,
    TeamClusterQueueScopeLimitView,
    TeamClusterQueueScopeLimitsView,
    TeamClusterRuntimeRoleConfigView,
    TeamClusterEffectiveCapabilitiesView,
    TeamClusterView
} from '@modules/cluster/contracts/TeamClusterView';

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
