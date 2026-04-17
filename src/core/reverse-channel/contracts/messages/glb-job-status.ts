interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

export interface GlbJobStatusPayload {
    error?: string;
    jobId: string;
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
}

export interface GlbJobStatusMessage extends AuthenticatedMessageContext {
    error?: string;
    jobId: string;
    status: 'running' | 'completed' | 'failed';
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
    type: 'trajectory-glb-job-status';
}

export const createGlbJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: GlbJobStatusPayload,
    status: GlbJobStatusMessage['status']
): GlbJobStatusMessage => ({
    type: 'trajectory-glb-job-status',
    status,
    ...context,
    ...payload,
    ...('error' in payload ? { error: payload.error } : {})
});

export const createGlbJobStatusDedupeKey = (payload: GlbJobStatusPayload, status: GlbJobStatusMessage['status']): string => {
    return `trajectory.glb-job-status:${payload.jobId}:${status}:${payload.timestep === undefined ? 'none' : payload.timestep}`;
};
