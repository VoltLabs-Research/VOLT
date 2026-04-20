import {
    readTimestepDedupeSegment,
    type AuthenticatedMessageContext,
    type AuthenticatedReverseChannelMessage
} from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import type { ExecutionLogSegment } from '@/core/runtime/contracts/execution-log';
import type {
    BaseAnalysisEventData
} from '@/modules/analysis/domain/events';

type AnalysisJobCompletionPayload = BaseAnalysisEventData & { error?: string };

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
    BaseAnalysisEventData & { status: 'running' }
>;

export type AnalysisJobCompletionMessage = AuthenticatedReverseChannelMessage<
    'analysis-job-completion',
    AnalysisJobCompletionPayload & { success: boolean }
>;

export type AnalysisLogChunkMessage = AuthenticatedReverseChannelMessage<'analysis-log-chunk', AnalysisLogChunkPayload>;

export type DebugLogChunkMessage = AuthenticatedReverseChannelMessage<'debug-log-chunk', DebugLogChunkPayload>;

export const createAnalysisJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: BaseAnalysisEventData
): AnalysisJobStatusMessage => ({
    type: 'analysis-job-status',
    ...context,
    ...payload,
    status: 'running'
});

export const createAnalysisJobStatusDedupeKey = (
    payload: Pick<BaseAnalysisEventData, 'jobId' | 'timestep'>
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
    ...(payload.error !== undefined ? { error: payload.error } : {}),
    success: payload.error === undefined
});

export const createAnalysisJobCompletionDedupeKey = (
    payload: Pick<BaseAnalysisEventData, 'jobId' | 'timestep'> & { error?: string }
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
