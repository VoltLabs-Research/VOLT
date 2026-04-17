interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

interface RasterJobStatusPayloadBase {
    jobId: string;
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
}

interface RasterJobStatusFailedPayload extends RasterJobStatusPayloadBase {
    error: string;
}

type RasterJobStatusPayload = RasterJobStatusPayloadBase | RasterJobStatusFailedPayload;

export interface RasterJobStatusMessage extends AuthenticatedMessageContext {
    error?: string;
    jobId: string;
    status: 'running' | 'completed' | 'failed';
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
    type: 'trajectory-raster-job-status';
}

const TIMESTEP_DEDUPE_SEGMENT_NONE = 'none';

export const createRasterJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: RasterJobStatusPayload,
    status: RasterJobStatusMessage['status']
): RasterJobStatusMessage => ({
    type: 'trajectory-raster-job-status',
    status,
    ...context,
    ...payload,
    ...('error' in payload ? { error: payload.error } : {})
});

export const createRasterJobStatusDedupeKey = (
    payload: RasterJobStatusPayload,
    status: RasterJobStatusMessage['status']
): string => {
    return `trajectory.raster-job-status:${payload.jobId}:${status}:${payload.timestep ?? TIMESTEP_DEDUPE_SEGMENT_NONE}`;
};
