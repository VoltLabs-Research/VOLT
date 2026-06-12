import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { AnalysisStageChangedEventPayload } from '@shared/contracts/events/AnalysisStageChangedPayload';

export type { AnalysisStageChangedEventPayload };

export default class AnalysisStageChangedEvent extends BaseDomainEvent<AnalysisStageChangedEventPayload> {
    constructor(payload: AnalysisStageChangedEventPayload) {
        super('analysis.stage.changed', payload);
    }
}
