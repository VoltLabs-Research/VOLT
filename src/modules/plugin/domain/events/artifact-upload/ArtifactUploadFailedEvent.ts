import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseArtifactUploadEventData } from '@/modules/plugin/domain/events/shared/base-artifact-upload-event-data';

export type ArtifactUploadFailedEventData = BaseArtifactUploadEventData & { error: string };

export class ArtifactUploadFailedEvent extends BaseDomainEvent<ArtifactUploadFailedEventData> {
    static readonly eventName = 'plugin.artifact-upload.failed';

    constructor(payload: ArtifactUploadFailedEventData) {
        super(ArtifactUploadFailedEvent.eventName, payload);
    }
}
