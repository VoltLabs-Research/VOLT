import { createDomainEvent } from '@shared/domain/events/createDomainEvent';
import type {
    AnalysisStageStatusPayload,
    AnalysisLogChunkPayload,
    DebugLogChunkPayload
} from '@shared/contracts/channel/reverse-channel-analysis';
import type { Failed, JobIdentity } from '@shared/contracts/types/job-identity';
import type { AnalysisProvenance } from '@shared/contracts/types/provenance-types';

export type BaseAnalysisEventData = JobIdentity & { name: string };

type AnalysisFailedEventData = Failed<BaseAnalysisEventData>;

export const AnalysisStartedEvent = createDomainEvent<BaseAnalysisEventData>('analysis.started');
export const AnalysisCompletedEvent = createDomainEvent<BaseAnalysisEventData>('analysis.completed');
export const AnalysisFailedEvent = createDomainEvent<AnalysisFailedEventData>('analysis.failed');
export const AnalysisStageStatusReportedEvent = createDomainEvent<AnalysisStageStatusPayload>('analysis.stage-status-reported');
export const AnalysisLogChunkReportedEvent = createDomainEvent<AnalysisLogChunkPayload>('analysis.log-chunk-reported');
export const DebugLogChunkReportedEvent = createDomainEvent<DebugLogChunkPayload>('analysis.debug-log-chunk-reported');
export const AnalysisProvenanceRecordedEvent = createDomainEvent<AnalysisProvenance>('analysis.provenance-recorded');
