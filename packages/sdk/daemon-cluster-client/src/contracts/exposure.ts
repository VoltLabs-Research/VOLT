type ValueOf<T> = T[keyof T];

export const TEAM_CLUSTER_SERVICE_EXPOSURE = Object.freeze({
    AccessMode: Object.freeze({
        Http: 'http',
        Tcp: 'tcp',
        WebSocket: 'websocket'
    }),
    Status: Object.freeze({
        Active: 'active',
        Unavailable: 'unavailable'
    }),
    SourceKind: Object.freeze({
        Container: 'container',
        Daemon: 'daemon'
    })
});

export type TeamClusterServiceExposureAccessMode = ValueOf<typeof TEAM_CLUSTER_SERVICE_EXPOSURE.AccessMode>;
export type TeamClusterServiceExposureStatus = ValueOf<typeof TEAM_CLUSTER_SERVICE_EXPOSURE.Status>;
export type TeamClusterServiceExposureSourceKind = ValueOf<typeof TEAM_CLUSTER_SERVICE_EXPOSURE.SourceKind>;

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
