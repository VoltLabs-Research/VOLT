export interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export interface AnalysisJobStatusPayload {
    analysisId: string;
    jobId: string;
    name: string;
    teamId: string;
    timestep?: number;
    trajectoryId?: string;
    trajectoryName?: string;
}

export interface AnalysisJobStatusMessage extends AuthenticatedMessageContext, AnalysisJobStatusPayload {
    status: 'running';
    type: 'analysis-job-status';
}

export const createAnalysisJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: AnalysisJobStatusPayload
): AnalysisJobStatusMessage => ({
    type: 'analysis-job-status',
    status: 'running',
    ...context,
    ...payload
});

export const createAnalysisJobStatusDedupeKey = (payload: AnalysisJobStatusPayload): string => {
    return `analysis.job-status:${payload.jobId}:running:${payload.timestep === undefined ? 'none' : payload.timestep}`;
};
