import type { TeamClusterDaemonExposureSnapshotPayload } from '@voltstack/daemon-cluster-client';

export type ExposureSnapshotMessage = TeamClusterDaemonExposureSnapshotPayload;

export type ExposureSnapshotPayload = Omit<ExposureSnapshotMessage, 'type'>;

export const createExposureSnapshotMessage = (
    payload: ExposureSnapshotPayload
): ExposureSnapshotMessage => ({
    type: 'exposure-snapshot',
    ...payload
});
