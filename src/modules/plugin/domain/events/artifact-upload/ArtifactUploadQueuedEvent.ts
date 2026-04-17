import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseArtifactUploadEventData } from '@/modules/plugin/domain/events/shared/BaseArtifactUploadEventData';

export interface ArtifactUploadQueuedEventData extends BaseArtifactUploadEventData {}

export class ArtifactUploadQueuedEvent extends BaseDomainEvent<ArtifactUploadQueuedEventData> {
    static readonly eventName = 'plugin.artifact-upload.queued';

    constructor(payload: ArtifactUploadQueuedEventData) {
        super(ArtifactUploadQueuedEvent.eventName, payload);
    }
}
