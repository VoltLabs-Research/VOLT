import { createArtifactUploadJobStatusDedupeKey, createArtifactUploadJobStatusMessage } from '@/core/reverse-channel/contracts/messages/artifact-upload-job-status';
import { createSceneArtifactUpsertBatchMessage } from '@/core/reverse-channel/contracts/messages/scene-artifact-upsert-batch';
import { BufferedTransportEventSubscriber } from '@/core/reverse-channel/infrastructure/events/TransportEventSubscriber';
import { SceneArtifactBatchReportedEvent } from '@/modules/plugin/application/events/SceneArtifactBatchReportedEvent';
import { ArtifactUploadCompletedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadCompletedEvent';
import { ArtifactUploadFailedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadFailedEvent';
import { ArtifactUploadQueuedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadQueuedEvent';
import { ArtifactUploadStartedEvent } from '@/modules/plugin/domain/events/artifact-upload/ArtifactUploadStartedEvent';

class ArtifactUploadStatusSubscriber<
    TEvent extends ArtifactUploadQueuedEvent | ArtifactUploadStartedEvent | ArtifactUploadCompletedEvent | ArtifactUploadFailedEvent
> extends BufferedTransportEventSubscriber<TEvent> {
    protected getDedupeKey(event: TEvent): string {
        if (event instanceof ArtifactUploadQueuedEvent) {
            return createArtifactUploadJobStatusDedupeKey(event.payload, 'queued');
        }

        if (event instanceof ArtifactUploadStartedEvent) {
            return createArtifactUploadJobStatusDedupeKey(event.payload, 'running');
        }

        if (event instanceof ArtifactUploadCompletedEvent) {
            return createArtifactUploadJobStatusDedupeKey(event.payload, 'completed');
        }

        return createArtifactUploadJobStatusDedupeKey(event.payload, 'failed');
    }
}

export class ArtifactUploadQueuedEventSubscriber extends ArtifactUploadStatusSubscriber<ArtifactUploadQueuedEvent> {
    static readonly subscribedTo = ArtifactUploadQueuedEvent.eventName;

    protected buildMessage(event: ArtifactUploadQueuedEvent) {
        return createArtifactUploadJobStatusMessage(this.getMessageContext(), event.payload, 'queued');
    }
}

export class ArtifactUploadStartedEventSubscriber extends ArtifactUploadStatusSubscriber<ArtifactUploadStartedEvent> {
    static readonly subscribedTo = ArtifactUploadStartedEvent.eventName;

    protected buildMessage(event: ArtifactUploadStartedEvent) {
        return createArtifactUploadJobStatusMessage(this.getMessageContext(), event.payload, 'running');
    }
}

export class ArtifactUploadCompletedEventSubscriber extends ArtifactUploadStatusSubscriber<ArtifactUploadCompletedEvent> {
    static readonly subscribedTo = ArtifactUploadCompletedEvent.eventName;

    protected buildMessage(event: ArtifactUploadCompletedEvent) {
        return createArtifactUploadJobStatusMessage(this.getMessageContext(), event.payload, 'completed');
    }
}

export class ArtifactUploadFailedEventSubscriber extends ArtifactUploadStatusSubscriber<ArtifactUploadFailedEvent> {
    static readonly subscribedTo = ArtifactUploadFailedEvent.eventName;

    protected buildMessage(event: ArtifactUploadFailedEvent) {
        return createArtifactUploadJobStatusMessage(this.getMessageContext(), event.payload, 'failed');
    }
}

export class SceneArtifactBatchReportedEventSubscriber extends BufferedTransportEventSubscriber<SceneArtifactBatchReportedEvent> {
    static readonly subscribedTo = SceneArtifactBatchReportedEvent.eventName;

    protected buildMessage(event: SceneArtifactBatchReportedEvent) {
        return createSceneArtifactUpsertBatchMessage(this.getMessageContext(), event.payload);
    }
}
