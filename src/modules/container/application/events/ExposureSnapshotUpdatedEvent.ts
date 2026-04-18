import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { ExposureSnapshotPayload } from '@/modules/container/contracts/reverse-channel-container';

export type ExposureSnapshotUpdatedEventData = ExposureSnapshotPayload;

export class ExposureSnapshotUpdatedEvent extends BaseDomainEvent<ExposureSnapshotUpdatedEventData> {
    static readonly eventName = 'container.exposure-snapshot-updated';

    constructor(payload: ExposureSnapshotUpdatedEventData) {
        super(ExposureSnapshotUpdatedEvent.eventName, payload);
    }
}
