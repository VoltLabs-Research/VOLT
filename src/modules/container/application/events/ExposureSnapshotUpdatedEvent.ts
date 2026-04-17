import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { TeamClusterServiceExposure } from '@/core/runtime/contracts/serviceExposure';

export interface ExposureSnapshotUpdatedEventData {
    exposures: TeamClusterServiceExposure[];
}

export class ExposureSnapshotUpdatedEvent extends BaseDomainEvent<ExposureSnapshotUpdatedEventData> {
    static readonly eventName = 'container.exposure-snapshot-updated';

    constructor(payload: ExposureSnapshotUpdatedEventData) {
        super(ExposureSnapshotUpdatedEvent.eventName, payload);
    }
}
