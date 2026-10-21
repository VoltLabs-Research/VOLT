import type { SceneArtifactUpsertItem, DaemonJobIdentity } from '@volt/contracts/modules/cluster/daemon-events';

export interface ArtifactStageInput {
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName?: string;
}

export type ArtifactStageBufferInput = ArtifactStageInput & {
    buffer: Buffer;
};

export interface ArtifactUploadBatchContext extends Omit<DaemonJobIdentity, 'jobId'> {
    analysisId: string;
    analysisJobId: string;
    trajectoryId: string;
}

export interface ArtifactUploadStageInput extends ArtifactStageInput {
    ownerClusterId: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
    reportArtifact?: SceneArtifactUpsertItem;
}

type ArtifactUploadStageFileInput = ArtifactUploadStageInput & {
    sourcePath: string;
};

export type ArtifactUploadStageBufferInput = ArtifactUploadStageInput & {
    buffer: Buffer;
};

export type ArtifactUploadBatchUpload = Omit<ArtifactUploadStageFileInput, 'fileName'>;

export interface ArtifactUploadBatchJobPayload extends DaemonJobIdentity {
    analysisId: string;
    analysisJobId: string;
    trajectoryId: string;
    batchDirectory: string;
    uploads: ArtifactUploadBatchUpload[];
}

export interface ArtifactUploadBatchEnqueueResult {
    jobId?: string;
    queuedUploads: number;
}

export interface ArtifactUploadBatch {
    stageBufferUpload(input: ArtifactUploadStageBufferInput): Promise<void>;
    enqueue(): Promise<ArtifactUploadBatchEnqueueResult>;
    cleanup(): Promise<void>;
}
