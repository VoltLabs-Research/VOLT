import TeamCluster, {
    TeamClusterDaemonServiceProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterServiceProps,
    TeamClusterServicesProps,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
import type { ClusterTransferJobDTO } from '@modules/cluster/application/dtos/ClusterTransferJobDTO';

export interface TeamClusterServiceDTO {
    port: number | null;
}

export interface TeamClusterServicesDTO {
    minio: TeamClusterServiceDTO;
    redis: TeamClusterServiceDTO;
    mongodb: TeamClusterServiceDTO;
    daemon: TeamClusterServiceDTO;
}

export interface TeamClusterCredentialServiceDTO extends TeamClusterServiceDTO {
    username: string;
    password: string;
}

export interface TeamClusterDaemonCredentialServiceDTO extends TeamClusterServiceDTO {
    password: string;
}

export interface TeamClusterCredentialServicesDTO {
    minio: TeamClusterCredentialServiceDTO;
    redis: TeamClusterCredentialServiceDTO;
    mongodb: TeamClusterCredentialServiceDTO;
    daemon: TeamClusterDaemonCredentialServiceDTO;
}

export interface TeamClusterQueueConcurrencyDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    sshImport: number;
}

export interface TeamClusterQueueScopeLimitDTO {
    maxRunningPerTrajectory: number;
    maxRunningPerTeam: number;
}

export interface TeamClusterQueueScopeLimitsDTO {
    analysisProcessing: TeamClusterQueueScopeLimitDTO;
    artifactUpload: TeamClusterQueueScopeLimitDTO;
    trajectoryRasterization: TeamClusterQueueScopeLimitDTO;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitDTO;
    cloudUpload: TeamClusterQueueScopeLimitDTO;
    trajectoryCompression: TeamClusterQueueScopeLimitDTO;
}

export interface TeamClusterRuntimeRoleConfigDTO {
    desiredRole: TeamClusterRuntimeRoleConfigProps['desiredRole'];
    effectiveRole: TeamClusterRuntimeRoleConfigProps['effectiveRole'];
    runtimeVersion: number;
    draining: {
        compute: boolean;
        storage: boolean;
    };
    lastAppliedAt?: Date | null;
}

export interface TeamClusterEffectiveCapabilitiesDTO {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
}

export interface TeamClusterDTO {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesDTO;
    queueConcurrency: TeamClusterQueueConcurrencyDTO;
    queueScopeLimits: TeamClusterQueueScopeLimitsDTO;
    roleConfig: TeamClusterRuntimeRoleConfigDTO;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesDTO;
    activeTransfers?: ClusterTransferJobDTO[];
    isDemo: boolean;
    demoExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const toServiceDTO = (service: TeamClusterServiceProps | TeamClusterDaemonServiceProps): TeamClusterServiceDTO => {
    return {
        port: service.port
    };
};

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
        queueConcurrency: {
            ...teamCluster.props.queueConcurrency
        },
        queueScopeLimits: {
            analysisProcessing: {
                ...teamCluster.props.queueScopeLimits.analysisProcessing
            },
            artifactUpload: {
                ...teamCluster.props.queueScopeLimits.artifactUpload
            },
            trajectoryRasterization: {
                ...teamCluster.props.queueScopeLimits.trajectoryRasterization
            },
            trajectoryGlbConversion: {
                ...teamCluster.props.queueScopeLimits.trajectoryGlbConversion
            },
            cloudUpload: {
                ...teamCluster.props.queueScopeLimits.cloudUpload
            },
            trajectoryCompression: {
                ...teamCluster.props.queueScopeLimits.trajectoryCompression
            }
        },
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
