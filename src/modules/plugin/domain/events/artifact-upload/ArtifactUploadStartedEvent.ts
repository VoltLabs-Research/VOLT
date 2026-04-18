import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseArtifactUploadEventData } from '@/modules/plugin/domain/events/shared/base-artifact-upload-event-data';

export type ArtifactUploadStartedEventData = BaseArtifactUploadEventData;

export class ArtifactUploadStartedEvent extends BaseDomainEvent<ArtifactUploadStartedEventData> {
    static readonly eventName = 'plugin.artifact-upload.started';

    constructor(payload: ArtifactUploadStartedEventData) {
        super(ArtifactUploadStartedEvent.eventName, payload);
    }
}
