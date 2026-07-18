import TeamCluster, {
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS,
    TeamClusterDaemonServiceProps,
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps,
    TeamClusterServiceProps,
    TeamClusterServicesProps
} from '@modules/cluster/entities/TeamCluster';
import type { ClusterTransferJobDTO } from '@modules/cluster/contracts/ClusterTransferJobView';
import type {
    TeamClusterServiceDTO,
    TeamClusterQueueConcurrencyDTO,
    TeamClusterQueueScopeLimitsDTO,
    TeamClusterDTO
} from '@modules/cluster/contracts/TeamClusterView';

export type {
    TeamClusterServiceDTO,
    TeamClusterServicesDTO,
    TeamClusterCredentialServiceDTO,
    TeamClusterDaemonCredentialServiceDTO,
    TeamClusterCredentialServicesDTO,
    TeamClusterQueueConcurrencyDTO,
    TeamClusterQueueScopeLimitDTO,
    TeamClusterQueueScopeLimitsDTO,
    TeamClusterRuntimeRoleConfigDTO,
    TeamClusterEffectiveCapabilitiesDTO,
    TeamClusterDTO
} from '@modules/cluster/contracts/TeamClusterView';

const toServiceDTO = (service: TeamClusterServiceProps | TeamClusterDaemonServiceProps): TeamClusterServiceDTO => {
    return {
        port: service.port
    };
};

export const toTeamClusterQueueConcurrencyDTO = (
    queueConcurrency: TeamClusterQueueConcurrencyProps
): TeamClusterQueueConcurrencyDTO => ({
    analysis: queueConcurrency.analysis,
    rasterizer: queueConcurrency.rasterizer,
    glbPreprocessing: queueConcurrency.glbPreprocessing,
    artifactUpload: queueConcurrency.artifactUpload,
    pluginWarmup: queueConcurrency.pluginWarmup
});

export const toTeamClusterQueueScopeLimitsDTO = (
    queueScopeLimits: TeamClusterQueueScopeLimitsProps
): TeamClusterQueueScopeLimitsDTO => ({
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

export const toTeamClusterDTO = (
    teamCluster: TeamCluster,
    options: {
        activeTransfers?: ClusterTransferJobDTO[];
    } = {}
): TeamClusterDTO => {
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
            minio: toServiceDTO(services.minio),
            redis: toServiceDTO(services.redis),
            mongodb: toServiceDTO(services.mongodb),
            daemon: toServiceDTO(services.daemon)
        },
        queueConcurrency: toTeamClusterQueueConcurrencyDTO(teamCluster.props.queueConcurrency),
        queueScopeLimits: toTeamClusterQueueScopeLimitsDTO(
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
