import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/shared/BaseAnalysisEventData';

export interface AnalysisCompletedEventData extends BaseAnalysisEventData {}

export class AnalysisCompletedEvent extends BaseDomainEvent<AnalysisCompletedEventData> {
    static readonly eventName = 'analysis.completed';

    constructor(payload: AnalysisCompletedEventData) {
        super(AnalysisCompletedEvent.eventName, payload);
    }
}
