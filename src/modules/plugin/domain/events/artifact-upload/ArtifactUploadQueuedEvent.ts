import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseArtifactUploadEventData } from '@/modules/plugin/domain/events/shared/base-artifact-upload-event-data';

export type ArtifactUploadQueuedEventData = BaseArtifactUploadEventData;

export class ArtifactUploadQueuedEvent extends BaseDomainEvent<ArtifactUploadQueuedEventData> {
    static readonly eventName = 'plugin.artifact-upload.queued';

    constructor(payload: ArtifactUploadQueuedEventData) {
        super(ArtifactUploadQueuedEvent.eventName, payload);
    }
}
