export type ExposureSnapshotAccessMode = 'http' | 'tcp' | 'websocket';

export type ExposureSnapshotStatus = 'active' | 'unavailable';

export type ExposureSnapshotSourceKind = 'container' | 'daemon';

export interface ExposureSnapshot {
    id: string;
    teamClusterId: string;
    teamId: string;
    sourceKind: ExposureSnapshotSourceKind;
    exposureName: string;
    accessModes: ExposureSnapshotAccessMode[];
    targetHost: string;
    targetPort: number;
    status: ExposureSnapshotStatus;
    labels: Record<string, string>;
    containerId?: string;
    containerName?: string;
    containerPort?: number;
}

export interface ExposureSnapshotMessage {
    exposures: ExposureSnapshot[];
    type: 'exposure-snapshot';
}

export const createExposureSnapshotMessage = (exposures: ExposureSnapshot[]): ExposureSnapshotMessage => ({
    type: 'exposure-snapshot',
    exposures
});
