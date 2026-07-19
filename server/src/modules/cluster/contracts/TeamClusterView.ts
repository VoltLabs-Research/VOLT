import type {
    TeamClusterStatus,
    TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';
import type { ClusterTransferJobView } from '@modules/cluster/contracts/ClusterTransferJobView';

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
