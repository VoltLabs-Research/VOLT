import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/base-analysis-event-data';

export type AnalysisStartedEventData = BaseAnalysisEventData;

export class AnalysisStartedEvent extends BaseDomainEvent<AnalysisStartedEventData> {
    static readonly eventName = 'analysis.started';

    constructor(payload: AnalysisStartedEventData) {
        super(AnalysisStartedEvent.eventName, payload);
    }
}
