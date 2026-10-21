import type {
    ArtifactUploadJobStatusEvent,
    ArtifactUploadJobStatusReport,
    DaemonIdentity,
    DaemonJobStatus,
    SceneArtifactUpsertBatch,
    SceneArtifactUpsertBatchEvent
} from '@volt/contracts/modules/cluster/daemon-events';

type ArtifactUploadJobStatusPayload = Omit<ArtifactUploadJobStatusReport, 'status'>;

export const createArtifactUploadJobStatusMessage = (
    context: DaemonIdentity,
    payload: ArtifactUploadJobStatusPayload,
    status: DaemonJobStatus
): ArtifactUploadJobStatusEvent => ({
    type: 'artifact-upload-job-status',
    ...context,
    ...payload,
    ...(payload.error !== undefined ? { error: payload.error } : {}),
    status
});

export const createArtifactUploadJobStatusDedupeKey = (
    payload: Pick<ArtifactUploadJobStatusReport, 'jobId'>,
    status: DaemonJobStatus
): string => {
    return `artifact-upload.job-status:${payload.jobId}:${status}`;
};

export const createSceneArtifactUpsertBatchMessage = (
    context: DaemonIdentity,
    payload: SceneArtifactUpsertBatch
): SceneArtifactUpsertBatchEvent => ({
    type: 'trajectory-scene-artifact-upsert-batch',
    ...context,
    ...payload
});

