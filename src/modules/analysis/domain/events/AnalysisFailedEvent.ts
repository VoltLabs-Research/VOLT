import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/shared/BaseAnalysisEventData';

export interface AnalysisFailedEventData extends BaseAnalysisEventData {
    error: string;
}

export class AnalysisFailedEvent extends BaseDomainEvent<AnalysisFailedEventData> {
    static readonly eventName = 'analysis.failed';

    constructor(payload: AnalysisFailedEventData) {
        super(AnalysisFailedEvent.eventName, payload);
    }
}
