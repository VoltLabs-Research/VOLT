import { createDomainEvent } from '@shared/events/create-domain-event';
import type { Failed } from '@shared/contracts/types/job-identity';
import type {
    AnalysisJobReport,
    AnalysisLogChunk,
    AnalysisStageStatusReport,
    DebugLogChunk,
    AnalysisProvenance
} from '@volt/contracts/modules/cluster/daemon-events';

export type BaseAnalysisEventData = AnalysisJobReport;

type AnalysisFailedEventData = Failed<BaseAnalysisEventData>;

export const AnalysisStartedEvent = createDomainEvent<BaseAnalysisEventData>('analysis.started');
export const AnalysisCompletedEvent = createDomainEvent<BaseAnalysisEventData>('analysis.completed');
export const AnalysisFailedEvent = createDomainEvent<AnalysisFailedEventData>('analysis.failed');
export const AnalysisStageStatusReportedEvent = createDomainEvent<AnalysisStageStatusReport>('analysis.stage-status-reported');
export const AnalysisLogChunkReportedEvent = createDomainEvent<AnalysisLogChunk>('analysis.log-chunk-reported');
export const DebugLogChunkReportedEvent = createDomainEvent<DebugLogChunk>('analysis.debug-log-chunk-reported');
export const AnalysisProvenanceRecordedEvent = createDomainEvent<AnalysisProvenance>('analysis.provenance-recorded');
