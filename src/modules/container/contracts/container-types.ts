import type { TeamClusterServiceExposure } from '@/core/runtime/contracts/service-exposure';

export const TeamClusterStatus = Object.freeze({
    WaitingForConnection: 'waiting-for-connection',
    HealthcheckReceived: 'healthcheck-received',
    PreparingEnvironment: 'preparing-environment',
    DependencyInstallationFailed: 'dependency-installation-failed',
    OperatingSystemNotSupported: 'operating-system-not-supported',
    Connected: 'connected',
    Disconnected: 'disconnected',
    Deleting: 'deleting',
    DeleteFailed: 'delete-failed',
    Updating: 'updating',
    UpdateFailed: 'update-failed'
} as const);
export type TeamClusterStatus = typeof TeamClusterStatus[keyof typeof TeamClusterStatus];

export interface ExposureSnapshotPayload {
    exposures: TeamClusterServiceExposure[];
}

export type ExposureSnapshotMessage = ExposureSnapshotPayload & { type: 'exposure-snapshot' };

export const createExposureSnapshotMessage = (
    payload: ExposureSnapshotPayload
): ExposureSnapshotMessage => ({
    type: 'exposure-snapshot',
    ...payload
});
