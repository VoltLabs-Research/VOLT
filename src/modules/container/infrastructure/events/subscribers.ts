import { ImmediateTransportEventSubscriber } from '@/core/reverse-channel/infrastructure/events/TransportEventSubscriber';
import { ExposureSnapshotUpdatedEvent } from '@/modules/container/application/events/ExposureSnapshotUpdatedEvent';

export class ExposureSnapshotUpdatedEventSubscriber extends ImmediateTransportEventSubscriber<ExposureSnapshotUpdatedEvent> {
    static readonly subscribedTo = ExposureSnapshotUpdatedEvent.eventName;

    protected buildMessage(event: ExposureSnapshotUpdatedEvent) {
        return {
            type: 'exposure-snapshot' as const,
            exposures: event.payload.exposures
        };
    }
}
