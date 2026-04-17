import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseArtifactUploadEventData } from '@/modules/plugin/domain/events/shared/BaseArtifactUploadEventData';

export interface ArtifactUploadFailedEventData extends BaseArtifactUploadEventData {
    error: string;
}

export class ArtifactUploadFailedEvent extends BaseDomainEvent<ArtifactUploadFailedEventData> {
    static readonly eventName = 'plugin.artifact-upload.failed';

    constructor(payload: ArtifactUploadFailedEventData) {
        super(ArtifactUploadFailedEvent.eventName, payload);
    }
}
