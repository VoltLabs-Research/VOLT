import type { ClusterTransferJob } from '@/modules/cluster/api/entities/team-cluster-transfer';

export enum TeamClusterStatus {
    WaitingForConnection = 'waiting-for-connection',
    HealthcheckReceived = 'healthcheck-received',
    PreparingEnvironment = 'preparing-environment',
    DependenciesInstallationFailed = 'dependency-installation-failed',
    OperatingSystemNotSupported = 'operating-system-not-supported',
    Connected = 'connected',
    Disconnected = 'disconnected',
    Deleting = 'deleting',
    DeleteFailed = 'delete-failed',
    Updating = 'updating',
    UpdateFailed = 'update-failed'
};

export type TeamClusterRole = 'cluster' | 'storage-server' | 'compute-node';

export interface TeamClusterService {
    port: number | null;
};

export interface TeamClusterServices {
    minio: TeamClusterService;
    redis: TeamClusterService;
    mongodb: TeamClusterService;
    daemon: TeamClusterService;
};

export interface TeamClusterCredentialService extends TeamClusterService {
    username: string;
    password: string;
};

export interface TeamClusterDaemonCredentialService extends TeamClusterService {
    password: string;
};

export interface TeamClusterCredentialServices {
    minio: TeamClusterCredentialService;
    redis: TeamClusterCredentialService;
    mongodb: TeamClusterCredentialService;
    daemon: TeamClusterDaemonCredentialService;
};

export interface TeamClusterQueueConcurrency {
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    sshImport: number;
};

export interface TeamClusterQueueScopeLimit {
    maxRunningPerTrajectory: number;
    maxRunningPerTeam: number;
};

export interface TeamClusterQueueScopeLimits {
    analysisProcessing: TeamClusterQueueScopeLimit;
    artifactUpload: TeamClusterQueueScopeLimit;
    trajectoryGlbConversion: TeamClusterQueueScopeLimit;
    cloudUpload: TeamClusterQueueScopeLimit;
    trajectoryCompression: TeamClusterQueueScopeLimit;
};

export interface TeamClusterRoleDraining {
    compute: boolean;
    storage: boolean;
};

export interface TeamClusterRuntimeRoleConfig {
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: TeamClusterRoleDraining;
    lastAppliedAt: Date | string | null;
};

export interface TeamClusterEffectiveCapabilities {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
};

export interface TeamCluster {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | string | null;
    lastDisconnectAt: Date | string | null;
    services: TeamClusterServices;
    queueConcurrency: TeamClusterQueueConcurrency;
    queueScopeLimits: TeamClusterQueueScopeLimits;
    roleConfig: TeamClusterRuntimeRoleConfig;
    effectiveCapabilities: TeamClusterEffectiveCapabilities;
    activeTransfers?: ClusterTransferJob[];
    isDemo: boolean;
    demoExpiresAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
};

export interface TeamClusterLifecycleEvent {
    teamClusterId: string;
    teamId: string;
    deleted: boolean;
    teamCluster?: TeamCluster;
    status?: TeamClusterStatus;
    timestamp: string;
};
