import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { ExecutionLogSegment } from '@/modules/analysis/application/events/ExecutionLogSegment';

export interface DebugLogChunkReportedEventData {
    nodeId: string;
    segments: ExecutionLogSegment[];
    sessionId: string;
}

export class DebugLogChunkReportedEvent extends BaseDomainEvent<DebugLogChunkReportedEventData> {
    static readonly eventName = 'analysis.debug-log-chunk-reported';

    constructor(payload: DebugLogChunkReportedEventData) {
        super(DebugLogChunkReportedEvent.eventName, payload);
    }
}
