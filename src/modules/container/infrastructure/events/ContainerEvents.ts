import { EventGroup, OnEvent } from '@/core/events/decorators';
import { ClusterDaemonTransportEvents } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonTransportEvents';
import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/cluster-daemon-event-publisher';
import { ExposureSnapshotUpdatedEvent } from '@/modules/container/application/events/ExposureSnapshotUpdatedEvent';
import { createExposureSnapshotMessage } from '@/modules/container/contracts/reverse-channel-container';

@EventGroup('container')
export class ContainerEvents extends ClusterDaemonTransportEvents {
    constructor(voltCloudConnection: ClusterDaemonEventPublisher) {
        super(voltCloudConnection);
    }

    @OnEvent('exposure-snapshot-updated')
    exposureSnapshotUpdated(event: ExposureSnapshotUpdatedEvent): void {
        this.emitMessage(createExposureSnapshotMessage(event.payload));
    }
}
