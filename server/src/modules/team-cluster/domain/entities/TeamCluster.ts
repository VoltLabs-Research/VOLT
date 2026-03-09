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

export interface TeamClusterServiceProps {
    port: number | null;
    username?: string;
    password?: string;
};

export interface TeamClusterDaemonServiceProps {
    port: number | null;
    password?: string;
};

export interface TeamClusterServicesProps {
    minio: TeamClusterServiceProps;
    redis: TeamClusterServiceProps;
    mongodb: TeamClusterServiceProps;
    daemon: TeamClusterDaemonServiceProps;
};

export interface TeamClusterProps {
    name: string;
    team: string;
    createdBy: string;
    status: TeamClusterStatus;
    enrollmentTokenHash: string | null;
    installedVersion: string | null;
    lastHeartbeatAt: Date | null;
    lastDisconnectAt: Date | null;
    services: TeamClusterServicesProps;
    createdAt: Date;
    updatedAt: Date;
};

export default class TeamCluster {
    constructor(
        public readonly _id: string,
        public props: TeamClusterProps
    ){}

    public get id(): string {
        return this._id;
    }
};
