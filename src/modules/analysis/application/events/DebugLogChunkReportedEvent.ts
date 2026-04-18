import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { DebugLogChunkPayload } from '@/modules/analysis/contracts/reverse-channel-analysis';

export type DebugLogChunkReportedEventData = DebugLogChunkPayload;

export class DebugLogChunkReportedEvent extends BaseDomainEvent<DebugLogChunkReportedEventData> {
    static readonly eventName = 'analysis.debug-log-chunk-reported';

    constructor(payload: DebugLogChunkReportedEventData) {
        super(DebugLogChunkReportedEvent.eventName, payload);
    }
}
