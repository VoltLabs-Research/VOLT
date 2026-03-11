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
 * Represents a single persistent service exposure published by a container port.
 */
export interface TeamClusterServiceExposure {
    id: string;
    teamClusterId: string;
    teamId: string;
    containerId: string;
    containerName: string;
    exposureName: string;
    accessModes: TeamClusterServiceExposureAccessMode[];
    targetHost: string;
    targetPort: number;
    containerPort: number;
    status: TeamClusterServiceExposureStatus;
    labels: Record<string, string>;
};
