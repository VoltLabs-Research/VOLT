import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonEventPublisher';
import { OrchestrationAction } from '@/core/runtime/contracts/http.runtime';
import { RuntimeProgressEvent } from '@/core/runtime/events/RuntimeProgressEvent';
import { createRuntimeProgressMessage } from '@/core/reverse-channel/contracts/messages/runtime-progress';

export class RuntimeProgressEventSubscriber {
    static readonly subscribedTo = RuntimeProgressEvent.eventName;

    constructor(
        protected readonly event: RuntimeProgressEvent,
        protected readonly voltCloudConnection: ClusterDaemonEventPublisher
    ) {}

    handle(): void {
        if (this.event.payload.action !== OrchestrationAction.ContainerCreate) {
            return;
        }

        this.voltCloudConnection.getDaemonPassword();
        this.voltCloudConnection.getTeamClusterId();
        this.voltCloudConnection.emitMessage(createRuntimeProgressMessage(this.event.payload));
    }
}
