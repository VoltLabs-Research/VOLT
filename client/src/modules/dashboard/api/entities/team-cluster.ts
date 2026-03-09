export enum TeamClusterStatus {
    WaitingForConnection = 'waiting-for-connection',
    HealthcheckReceived = 'healthcheck-received',
    PreparingEnvironment = 'preparing-environment',
    DependenciesInstallationFailed = 'dependency-installation-failed',
    OperatingSystemNotSupported = 'operating-system-not-supported',
    Connected = 'connected',
    Disconnected = 'disconnected',
    Deleting = 'deleting',
    DeleteFailed = 'delete-failed'
};

export interface DashboardTeamClusterService {
    port: number | null;
};

export interface DashboardTeamClusterServices {
    minio: DashboardTeamClusterService;
    redis: DashboardTeamClusterService;
    mongodb: DashboardTeamClusterService;
    daemon: DashboardTeamClusterService;
};

export interface DashboardTeamCluster {
    _id: string;
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: DashboardTeamClusterServices;
    createdAt: Date;
    updatedAt: Date;
};
