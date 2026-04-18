import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/base-analysis-event-data';

export type AnalysisCompletedEventData = BaseAnalysisEventData;

export class AnalysisCompletedEvent extends BaseDomainEvent<AnalysisCompletedEventData> {
    static readonly eventName = 'analysis.completed';

    constructor(payload: AnalysisCompletedEventData) {
        super(AnalysisCompletedEvent.eventName, payload);
    }
}
