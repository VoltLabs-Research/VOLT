import type {
    AuthenticatedMessageContext,
    AuthenticatedReverseChannelMessage
} from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import type {
    ArtifactUploadFailedEventData,
    BaseArtifactUploadEventData
} from '@/modules/plugin/domain/events';

type ArtifactUploadJobStatus =
    | 'running'
    | 'completed'
    | 'failed';

type ArtifactUploadJobStatusPayload =
    | BaseArtifactUploadEventData
    | ArtifactUploadFailedEventData;

export interface SceneArtifactUpsertBatchItem {
    analysis?: string;
    displayName: string;
    metadata?: object;
    objectName: string;
    params: object;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    status: 'ready' | 'failed';
    storageBucket: string;
    storageClusterId: string;
    timestep: number;
    trajectory: string;
}

export interface SceneArtifactUpsertBatch {
    items: SceneArtifactUpsertBatchItem[];
}

export type ArtifactUploadJobStatusMessage = AuthenticatedReverseChannelMessage<
    'artifact-upload-job-status',
    BaseArtifactUploadEventData & { status: ArtifactUploadJobStatus; error?: string }
>;

export type SceneArtifactUpsertBatchMessage = AuthenticatedReverseChannelMessage<
    'trajectory-scene-artifact-upsert-batch',
    SceneArtifactUpsertBatch
>;

export const createArtifactUploadJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: ArtifactUploadJobStatusPayload,
    status: ArtifactUploadJobStatus
): ArtifactUploadJobStatusMessage => ({
    type: 'artifact-upload-job-status',
    ...context,
    ...payload,
    ...('error' in payload ? { error: payload.error } : {}),
    status
});

export const createArtifactUploadJobStatusDedupeKey = (
    payload: Pick<BaseArtifactUploadEventData, 'jobId'>,
    status: ArtifactUploadJobStatus
): string => {
    return `artifact-upload.job-status:${payload.jobId}:${status}`;
};

export const createSceneArtifactUpsertBatchMessage = (
    context: AuthenticatedMessageContext,
    payload: SceneArtifactUpsertBatch
): SceneArtifactUpsertBatchMessage => ({
    type: 'trajectory-scene-artifact-upsert-batch',
    ...context,
    ...payload
});
