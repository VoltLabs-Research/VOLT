export enum TeamClusterRole {
    Cluster = 'Cluster',
    ComputeNode = 'ComputeNode',
    StorageServer = 'StorageServer'
};

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

export interface TeamCluster {
    _id: string;
    name: string;
    role: TeamClusterRole;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | string | null;
    lastDisconnectAt: Date | string | null;
    services: TeamClusterServices;
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
