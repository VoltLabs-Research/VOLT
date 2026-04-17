import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseArtifactUploadEventData } from '@/modules/plugin/domain/events/shared/BaseArtifactUploadEventData';

export interface ArtifactUploadCompletedEventData extends BaseArtifactUploadEventData {}

export class ArtifactUploadCompletedEvent extends BaseDomainEvent<ArtifactUploadCompletedEventData> {
    static readonly eventName = 'plugin.artifact-upload.completed';

    constructor(payload: ArtifactUploadCompletedEventData) {
        super(ArtifactUploadCompletedEvent.eventName, payload);
    }
}
