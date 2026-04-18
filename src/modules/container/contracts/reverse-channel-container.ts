import type { TeamClusterServiceExposure } from '@/core/runtime/contracts/service-exposure';

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
