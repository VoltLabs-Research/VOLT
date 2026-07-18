import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';
import type { AnalysisStatusChangedEventPayload } from '@shared/contracts/events/AnalysisStatusChangedPayload';

export type { AnalysisStatusChangedEventPayload };

export default class AnalysisStatusChangedEvent extends BaseDomainEvent<AnalysisStatusChangedEventPayload> {
    constructor(payload: AnalysisStatusChangedEventPayload) {
        super('analysis.status.changed', payload);
    }
}
