import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import type {
    AnalysisJobCompletionEvent,
    AnalysisJobReport,
    AnalysisJobStatusEvent,
    AnalysisLogChunk,
    AnalysisLogChunkEvent,
    AnalysisProvenance,
    AnalysisProvenanceEvent,
    AnalysisStageStatusEvent,
    AnalysisStageStatusReport,
    DaemonIdentity,
    DebugLogChunk,
    DebugLogChunkEvent
} from '@volt/contracts/modules/cluster/daemon-events';

type AnalysisJobCompletionPayload = AnalysisJobReport & { error?: string };

export const createAnalysisProvenanceMessage = (
    context: DaemonIdentity,
    payload: AnalysisProvenance
): AnalysisProvenanceEvent => ({
    type: 'analysis-provenance',
    ...context,
    ...payload
});

export const createAnalysisJobStatusMessage = (
    context: DaemonIdentity,
    payload: AnalysisJobReport
): AnalysisJobStatusEvent => ({
    type: 'analysis-job-status',
    ...context,
    ...payload,
    status: JobStatus.Running
});

export const createAnalysisJobStatusDedupeKey = (
    payload: Pick<AnalysisJobReport, 'jobId' | 'timestep'>
): string => {
    return `analysis.job-status:${payload.jobId}:running:${payload.timestep ?? 'none'}`;
};

export const createAnalysisJobCompletionMessage = (
    context: DaemonIdentity,
    payload: AnalysisJobCompletionPayload
): AnalysisJobCompletionEvent => ({
    type: 'analysis-job-completion',
    ...context,
    ...payload,
    ...(payload.error !== undefined ? { error: payload.error } : {}),
    success: payload.error === undefined
});

export const createAnalysisStageStatusMessage = (
    context: DaemonIdentity,
    payload: AnalysisStageStatusReport
): AnalysisStageStatusEvent => ({
    type: 'analysis-stage-status',
    ...context,
    ...payload
});

export const createAnalysisStageStatusDedupeKey = (
    payload: Pick<AnalysisStageStatusReport, 'jobId' | 'stageKey' | 'stageStatus' | 'timestep'>
): string => {
    return `analysis.stage-status:${payload.jobId}:${payload.stageKey}:${payload.stageStatus}:${payload.timestep ?? 'none'}`;
};

export const createAnalysisJobCompletionDedupeKey = (
    payload: Pick<AnalysisJobReport, 'jobId' | 'timestep'> & { error?: string }
): string => {
    return `analysis.job-completion:${payload.jobId}:${payload.error ? 'failed' : 'completed'}:${payload.timestep ?? 'none'}`;
};

export const createAnalysisLogChunkMessage = (
    context: DaemonIdentity,
    payload: AnalysisLogChunk
): AnalysisLogChunkEvent => ({
    type: 'analysis-log-chunk',
    ...context,
    ...payload
});

export const createDebugLogChunkMessage = (
    context: DaemonIdentity,
    payload: DebugLogChunk
): DebugLogChunkEvent => ({
    type: 'debug-log-chunk',
    ...context,
    ...payload
});
