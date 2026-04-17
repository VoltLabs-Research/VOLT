interface ArtifactUploadJobStatusContext {
    daemonPassword: string;
    teamClusterId: string;
}

interface ArtifactUploadJobStatusPayload {
    analysisId: string;
    error?: string;
    jobId: string;
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
}

export interface ArtifactUploadJobStatusMessage extends ArtifactUploadJobStatusContext {
    analysisId: string;
    error?: string;
    jobId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    teamId: string;
    timestep?: number;
    trajectoryId: string;
    trajectoryName?: string;
    type: 'artifact-upload-job-status';
}

export const createArtifactUploadJobStatusMessage = (
    context: ArtifactUploadJobStatusContext,
    payload: ArtifactUploadJobStatusPayload,
    status: ArtifactUploadJobStatusMessage['status']
): ArtifactUploadJobStatusMessage => ({
    type: 'artifact-upload-job-status',
    status,
    ...context,
    ...payload,
    ...('error' in payload ? { error: payload.error } : {})
});

export const createArtifactUploadJobStatusDedupeKey = (
    payload: ArtifactUploadJobStatusPayload,
    status: ArtifactUploadJobStatusMessage['status']
): string => {
    return `artifact-upload.job-status:${payload.jobId}:${status}`;
};
