import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/shared/BaseAnalysisEventData';

export interface AnalysisStartedEventData extends BaseAnalysisEventData {}

export class AnalysisStartedEvent extends BaseDomainEvent<AnalysisStartedEventData> {
    static readonly eventName = 'analysis.started';

    constructor(payload: AnalysisStartedEventData) {
        super(AnalysisStartedEvent.eventName, payload);
    }
}
