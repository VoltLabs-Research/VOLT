interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

interface AnalysisJobCompletionPayloadBase {
    analysisId: string;
    jobId: string;
    name: string;
    teamId: string;
    timestep?: number;
}

interface AnalysisJobCompletedPayload extends AnalysisJobCompletionPayloadBase {
    error?: never;
}

interface AnalysisJobFailedPayload extends AnalysisJobCompletionPayloadBase {
    error: string;
}

type AnalysisJobCompletionPayload = AnalysisJobCompletedPayload | AnalysisJobFailedPayload;

export interface AnalysisJobCompletionMessage extends AuthenticatedMessageContext {
    analysisId: string;
    error?: string;
    jobId: string;
    name: string;
    success: boolean;
    teamId: string;
    timestep?: number;
    type: 'analysis-job-completion';
}

export const createAnalysisJobCompletionMessage = (
    context: AuthenticatedMessageContext,
    payload: AnalysisJobCompletionPayload
): AnalysisJobCompletionMessage => ({
    type: 'analysis-job-completion',
    ...context,
    analysisId: payload.analysisId,
    jobId: payload.jobId,
    name: payload.name,
    teamId: payload.teamId,
    timestep: payload.timestep,
    success: !('error' in payload),
    ...('error' in payload ? { error: payload.error } : {})
});

export const createAnalysisJobCompletionDedupeKey = (
    payload: AnalysisJobCompletionPayload
): string => {
    return `analysis.job-completion:${payload.jobId}:${'error' in payload ? 'failed' : 'completed'}:${payload.timestep === undefined ? 'none' : payload.timestep}`;
};
