import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { AnalysisLogChunkPayload } from '@/modules/analysis/contracts/reverse-channel-analysis';

export type AnalysisLogChunkReportedEventData = AnalysisLogChunkPayload;

export class AnalysisLogChunkReportedEvent extends BaseDomainEvent<AnalysisLogChunkReportedEventData> {
    static readonly eventName = 'analysis.log-chunk-reported';

    constructor(payload: AnalysisLogChunkReportedEventData) {
        super(AnalysisLogChunkReportedEvent.eventName, payload);
    }
}
