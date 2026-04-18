import type { AnalysisValueMap, QueuedJobNotification } from '@/modules/analysis/contracts/http-analysis';

interface TrajectoryReference {
    trajectoryId: string;
}

interface TeamTrajectoryReference extends TrajectoryReference {
    teamId: string;
}

interface TrajectoryFrameReference extends TrajectoryReference {
    timestep: number;
}

export interface TrajectoryQueueJobPayload<TMetadata = Record<string, unknown>> extends TeamTrajectoryReference {
    jobId: string;
    timestep: number;
    status: string;
    queueType: string;
    metadata?: TMetadata;
    error?: string;
    createdAt: string;
    updatedAt: string;
}

export type TrajectoryQueueRequest = TeamTrajectoryReference & {
    storageClusterId?: string;
};

export interface TrajectoryQueueResponse {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    jobs?: QueuedJobNotification[];
}

export type RasterJobMetadata = TrajectoryFrameReference & {
    analysisId?: string;
    model?: string;
    autoPreview: boolean;
};

export type GlbJobMetadata = TrajectoryFrameReference;

export interface RasterQueueJobPayload extends TrajectoryQueueJobPayload<RasterJobMetadata> {
    modelObjectKey: string;
    modelOwnerClusterId?: string;
    outputObjectKey: string;
    outputOwnerClusterId?: string;
}

export interface RasterizeTrajectoryRequest extends TrajectoryQueueRequest {
    config?: AnalysisValueMap;
}

export interface RasterizeTrajectoryResponse extends TrajectoryQueueResponse {
    alreadyRasterizedJobs: number;
    jobs: QueuedJobNotification[];
}

export interface GlbConversionQueueJobPayload extends TrajectoryQueueJobPayload<GlbJobMetadata> {
    objectKey: string;
    ownerClusterId?: string;
}

export interface EnqueuePreprocessingFrameDescriptor {
    timestep: number;
    objectKey: string;
    ownerClusterId?: string;
}

export interface EnqueuePreprocessingRequest extends TrajectoryQueueRequest {
    frames: EnqueuePreprocessingFrameDescriptor[];
}

export type EnqueuePreprocessingResponse = TrajectoryQueueResponse;
