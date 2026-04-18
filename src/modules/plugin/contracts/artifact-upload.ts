import type { SceneArtifactUpsertBatchItem } from '@/modules/plugin/contracts/reverse-channel-plugin';

export interface ArtifactStageInput {
    bucket: string;
    objectKey: string;
    contentType?: string;
    fileName?: string;
}

export type ArtifactStageFileInput = ArtifactStageInput & {
    sourcePath: string;
};

export type ArtifactStageBufferInput = ArtifactStageInput & {
    buffer: Buffer;
};

export interface ArtifactUploadBatchContext {
    analysisId: string;
    analysisJobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
}

export interface ArtifactUploadStageInput extends ArtifactStageInput {
    ownerClusterId: string;
    contentEncoding?: string;
    metadata?: Record<string, string>;
    reportArtifact?: SceneArtifactUpsertBatchItem;
}

export type ArtifactUploadStageFileInput = ArtifactUploadStageInput & {
    sourcePath: string;
};

export type ArtifactUploadStageBufferInput = ArtifactUploadStageInput & {
    buffer: Buffer;
};

export type ArtifactUploadBatchUpload = Omit<ArtifactUploadStageFileInput, 'fileName'>;

export interface ArtifactUploadBatchJobPayload {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    batchDirectory: string;
    uploads: ArtifactUploadBatchUpload[];
}

export interface ArtifactUploadBatchEnqueueResult {
    jobId?: string;
    queuedUploads: number;
}

export interface ArtifactUploadBatch {
    stageFileUpload(input: ArtifactUploadStageFileInput): Promise<void>;
    stageBufferUpload(input: ArtifactUploadStageBufferInput): Promise<void>;
    enqueue(): Promise<ArtifactUploadBatchEnqueueResult>;
    cleanup(): Promise<void>;
}
