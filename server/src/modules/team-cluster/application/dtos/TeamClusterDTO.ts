import TeamCluster, {
    TeamClusterEffectiveCapabilitiesProps,
    TeamClusterDaemonServiceProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterServiceProps,
    TeamClusterServicesProps,
    TeamClusterStatus
} from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ClusterTransferJobDTO } from '@modules/team-cluster/application/dtos/ClusterTransferJobDTO';

export interface TeamClusterServiceDTO {
    port: number | null;
};

export interface TeamClusterServicesDTO {
    minio: TeamClusterServiceDTO;
    redis: TeamClusterServiceDTO;
    mongodb: TeamClusterServiceDTO;
    daemon: TeamClusterServiceDTO;
};

export interface TeamClusterCredentialServiceDTO extends TeamClusterServiceDTO {
    username: string;
    password: string;
};

export interface TeamClusterDaemonCredentialServiceDTO extends TeamClusterServiceDTO {
    password: string;
};

export interface TeamClusterCredentialServicesDTO {
    minio: TeamClusterCredentialServiceDTO;
    redis: TeamClusterCredentialServiceDTO;
    mongodb: TeamClusterCredentialServiceDTO;
    daemon: TeamClusterDaemonCredentialServiceDTO;
};

export interface TeamClusterQueueConcurrencyDTO {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface TeamClusterRuntimeRoleConfigDTO {
    desiredRole: TeamClusterRuntimeRoleConfigProps['desiredRole'];
    effectiveRole: TeamClusterRuntimeRoleConfigProps['effectiveRole'];
    runtimeVersion: number;
    draining: {
        compute: boolean;
        storage: boolean;
    };
    lastAppliedAt?: Date | null;
};

export interface TeamClusterEffectiveCapabilitiesDTO {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
};

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
    roleConfig: TeamClusterRuntimeRoleConfigDTO;
    effectiveCapabilities: TeamClusterEffectiveCapabilitiesDTO;
    activeTransfers?: ClusterTransferJobDTO[];
    createdAt: Date;
    updatedAt: Date;
};

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
    const effectiveCapabilities: TeamClusterEffectiveCapabilitiesProps = teamCluster.props.effectiveCapabilities;
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
        createdAt: teamCluster.props.createdAt,
        updatedAt: teamCluster.props.updatedAt
    };
};
