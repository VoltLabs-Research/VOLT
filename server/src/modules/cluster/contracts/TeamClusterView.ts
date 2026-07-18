import type {
    TeamClusterStatus,
    TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';
import type { ClusterTransferJobDTO } from '@modules/cluster/contracts/ClusterTransferJobView';

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
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitDTO {
    maxRunningPerTrajectory: number;
}

export interface TeamClusterQueueScopeLimitsDTO {
    analysisProcessing: TeamClusterQueueScopeLimitDTO;
    artifactUpload: TeamClusterQueueScopeLimitDTO;
    trajectoryRasterization: TeamClusterQueueScopeLimitDTO;
    trajectoryGlbConversion: TeamClusterQueueScopeLimitDTO;
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
