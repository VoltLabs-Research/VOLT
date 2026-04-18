import type {
    AuthenticatedMessageContext,
    AuthenticatedReverseChannelMessage
} from '@/core/reverse-channel/contracts/authenticated';
import { readTimestepDedupeSegment } from '@/core/reverse-channel/contracts/reverse-channel-dedupe';
import type { ExecutionLogSegment } from '@/core/runtime/contracts/execution-log';
import type { AnalysisStartedEventData } from '@/modules/analysis/domain/events/AnalysisStartedEvent';
import type { BaseAnalysisEventData } from '@/modules/analysis/domain/events/base-analysis-event-data';

type AnalysisJobIdentity = Pick<
    BaseAnalysisEventData,
    'analysisId' | 'jobId' | 'name' | 'teamId' | 'timestep'
>;

type AnalysisJobCompletionPayload = AnalysisJobIdentity & { error?: string };

export interface AnalysisLogChunkPayload {
    analysisId: string;
    jobId: string;
    segments: ExecutionLogSegment[];
    teamId: string;
    timestep: number;
    trajectoryId: string;
}

export interface DebugLogChunkPayload {
    nodeId: string;
    segments: ExecutionLogSegment[];
    sessionId: string;
}

export type AnalysisJobStatusMessage = AuthenticatedReverseChannelMessage<
    'analysis-job-status',
    AnalysisStartedEventData & { status: 'running' }
>;

export type AnalysisJobCompletionMessage = AuthenticatedReverseChannelMessage<
    'analysis-job-completion',
    AnalysisJobCompletionPayload & { success: boolean }
>;

export type AnalysisLogChunkMessage = AuthenticatedReverseChannelMessage<'analysis-log-chunk', AnalysisLogChunkPayload>;

export type DebugLogChunkMessage = AuthenticatedReverseChannelMessage<'debug-log-chunk', DebugLogChunkPayload>;

export const createAnalysisJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: AnalysisStartedEventData
): AnalysisJobStatusMessage => ({
    type: 'analysis-job-status',
    status: 'running',
    ...context,
    ...payload
});

export const createAnalysisJobStatusDedupeKey = (
    payload: Pick<AnalysisStartedEventData, 'jobId' | 'timestep'>
): string => {
    return `analysis.job-status:${payload.jobId}:running:${readTimestepDedupeSegment(payload.timestep)}`;
};

export const createAnalysisJobCompletionMessage = (
    context: AuthenticatedMessageContext,
    payload: AnalysisJobCompletionPayload
): AnalysisJobCompletionMessage => ({
    type: 'analysis-job-completion',
    ...context,
    ...payload,
    success: payload.error === undefined,
    ...(payload.error !== undefined ? { error: payload.error } : {})
});

export const createAnalysisJobCompletionDedupeKey = (
    payload: Pick<AnalysisJobIdentity, 'jobId' | 'timestep'> & { error?: string }
): string => {
    return `analysis.job-completion:${payload.jobId}:${payload.error ? 'failed' : 'completed'}:${readTimestepDedupeSegment(payload.timestep)}`;
};

export const createAnalysisLogChunkMessage = (
    context: AuthenticatedMessageContext,
    payload: AnalysisLogChunkPayload
): AnalysisLogChunkMessage => ({
    type: 'analysis-log-chunk',
    ...context,
    ...payload
});

export const createDebugLogChunkMessage = (
    context: AuthenticatedMessageContext,
    payload: DebugLogChunkPayload
): DebugLogChunkMessage => ({
    type: 'debug-log-chunk',
    ...context,
    ...payload
});
