/**
 * Describes a public access mode supported by a team cluster service exposure.
 */
export enum TeamClusterServiceExposureAccessMode {
    Http = 'http',
    Tcp = 'tcp',
    WebSocket = 'websocket'
};

/**
 * Describes the operational state of an exposure registered by a team cluster daemon.
 */
export enum TeamClusterServiceExposureStatus {
    Active = 'active',
    Unavailable = 'unavailable'
};

/**
 * Describes where a team cluster service exposure originates.
 */
export enum TeamClusterServiceExposureSourceKind {
    Container = 'container',
    Daemon = 'daemon'
};

export interface TeamClusterServiceExposurePublicAccess {
    protocol: 'http' | 'https' | 'ws' | 'wss' | 'tcp';
    host: string;
    port: number;
}

/**
 * Represents a single persistent service exposure published by a team cluster daemon.
 */
export interface TeamClusterServiceExposure {
    id: string;
    teamClusterId: string;
    teamId: string;
    sourceKind: TeamClusterServiceExposureSourceKind;
    exposureName: string;
    accessModes: TeamClusterServiceExposureAccessMode[];
    targetHost: string;
    targetPort: number;
    status: TeamClusterServiceExposureStatus;
    labels: Record<string, string>;
    publicAccess?: TeamClusterServiceExposurePublicAccess;
    containerId?: string;
    containerName?: string;
    containerPort?: number;
};
