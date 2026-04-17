import { BaseDomainEvent } from '@/core/events/BaseDomainEvent';
import type { ExecutionLogSegment } from '@/modules/analysis/application/events/ExecutionLogSegment';

export interface AnalysisLogChunkReportedEventData {
    analysisId: string;
    jobId: string;
    segments: ExecutionLogSegment[];
    teamId: string;
    timestep: number;
    trajectoryId: string;
}

export class AnalysisLogChunkReportedEvent extends BaseDomainEvent<AnalysisLogChunkReportedEventData> {
    static readonly eventName = 'analysis.log-chunk-reported';

    constructor(payload: AnalysisLogChunkReportedEventData) {
        super(AnalysisLogChunkReportedEvent.eventName, payload);
    }
}
