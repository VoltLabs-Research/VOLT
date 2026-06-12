import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { AnalysisDeletedEventPayload } from '@shared/contracts/events/AnalysisDeletedPayload';

export type { AnalysisDeletedEventPayload };

export default class AnalysisDeletedEvent extends BaseDomainEvent<AnalysisDeletedEventPayload> {
    constructor(payload: AnalysisDeletedEventPayload) {
        super('analysis.deleted', payload);
    }
}
