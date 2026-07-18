

export enum TeamClusterServiceExposureAccessMode {
    Http = 'http',
    Tcp = 'tcp',
    WebSocket = 'websocket'
}

export enum TeamClusterServiceExposureStatus {
    Active = 'active',
    Unavailable = 'unavailable'
}

export enum TeamClusterServiceExposureSourceKind {
    Container = 'container',
    Daemon = 'daemon'
}

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
}

export interface TeamClusterDaemonExecutionLogSegment {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}
