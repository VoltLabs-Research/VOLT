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
    containerId?: string;
    containerName?: string;
    containerPort?: number;
};

export const TeamClusterServiceExposureAccessMode = Object.freeze({
    Http: 'http',
    Tcp: 'tcp',
    WebSocket: 'websocket'
} as const);
export type TeamClusterServiceExposureAccessMode = typeof TeamClusterServiceExposureAccessMode[keyof typeof TeamClusterServiceExposureAccessMode];

export const TeamClusterServiceExposureStatus = Object.freeze({
    Active: 'active',
    Unavailable: 'unavailable'
} as const);
export type TeamClusterServiceExposureStatus = typeof TeamClusterServiceExposureStatus[keyof typeof TeamClusterServiceExposureStatus];

export const TeamClusterServiceExposureSourceKind = Object.freeze({
    Container: 'container',
    Daemon: 'daemon'
} as const);
export type TeamClusterServiceExposureSourceKind = typeof TeamClusterServiceExposureSourceKind[keyof typeof TeamClusterServiceExposureSourceKind];
