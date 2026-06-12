import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { AnalysisCreatedEventPayload } from '@shared/contracts/events/AnalysisCreatedPayload';

export type { AnalysisCreatedEventPayload };

export default class AnalysisCreatedEvent extends BaseDomainEvent<AnalysisCreatedEventPayload> {
    constructor(payload: AnalysisCreatedEventPayload) {
        super('analysis.created', payload);
    }
}
