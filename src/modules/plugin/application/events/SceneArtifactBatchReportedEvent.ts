import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { SceneArtifactUpsertBatchItem } from '@/modules/plugin/application/events/SceneArtifactUpsertBatchItem';

export interface SceneArtifactBatchReportedEventData {
    items: SceneArtifactUpsertBatchItem[];
}

export class SceneArtifactBatchReportedEvent extends BaseDomainEvent<SceneArtifactBatchReportedEventData> {
    static readonly eventName = 'plugin.scene-artifact-batch-reported';

    constructor(payload: SceneArtifactBatchReportedEventData) {
        super(SceneArtifactBatchReportedEvent.eventName, payload);
    }
}
