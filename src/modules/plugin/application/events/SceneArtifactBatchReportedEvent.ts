import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { SceneArtifactUpsertBatch } from '@/modules/plugin/contracts/reverse-channel-plugin';

export type SceneArtifactBatchReportedEventData = SceneArtifactUpsertBatch;

export class SceneArtifactBatchReportedEvent extends BaseDomainEvent<SceneArtifactBatchReportedEventData> {
    static readonly eventName = 'plugin.scene-artifact-batch-reported';

    constructor(payload: SceneArtifactBatchReportedEventData) {
        super(SceneArtifactBatchReportedEvent.eventName, payload);
    }
}
