import { EventGroup, OnEvent } from '@/core/events/decorators';
import { ClusterDaemonTransportEvents } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonTransportEvents';
import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/cluster-daemon-event-publisher';
import { createRuntimeProgressMessage } from '@/core/runtime/contracts/reverse-channel-runtime';
import { OrchestrationAction } from '@/core/runtime/contracts/http-runtime';
import { RuntimeProgressEvent } from '@/core/runtime/events/RuntimeProgressEvent';

@EventGroup('runtime')
export class RuntimeEvents extends ClusterDaemonTransportEvents {
    constructor(voltCloudConnection: ClusterDaemonEventPublisher) {
        super(voltCloudConnection);
    }

    @OnEvent('progress')
    progress(event: RuntimeProgressEvent): void {
        if (event.payload.action !== OrchestrationAction.ContainerCreate) {
            return;
        }

        this.emitMessage(createRuntimeProgressMessage(event.payload));
    }
}
