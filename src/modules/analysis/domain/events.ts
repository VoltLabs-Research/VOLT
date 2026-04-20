import { createDomainEvent } from '@/core/events/createDomainEvent';
import type {
    AnalysisLogChunkPayload,
    DebugLogChunkPayload
} from '@/modules/analysis/contracts/reverse-channel-analysis';
import type { Failed, JobIdentity } from '@/support/contracts/job-identity';

export type BaseAnalysisEventData = JobIdentity & { name: string };

export type AnalysisFailedEventData = Failed<BaseAnalysisEventData>;

export const AnalysisStartedEvent = createDomainEvent<BaseAnalysisEventData>('analysis.started');
export const AnalysisCompletedEvent = createDomainEvent<BaseAnalysisEventData>('analysis.completed');
export const AnalysisFailedEvent = createDomainEvent<AnalysisFailedEventData>('analysis.failed');
export const AnalysisLogChunkReportedEvent = createDomainEvent<AnalysisLogChunkPayload>('analysis.log-chunk-reported');
export const DebugLogChunkReportedEvent = createDomainEvent<DebugLogChunkPayload>('analysis.debug-log-chunk-reported');
