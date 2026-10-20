import type { JobIdentity } from '@shared/contracts/types/job-identity';
import type { QueuedJobNotification } from '@shared/contracts/types/http-analysis';

export interface RasterizeTrajectoryRequest {
    trajectoryId: string;
    teamId: string;
    storageClusterId: string;
    config?: Record<string, unknown>;
}

export interface RasterizeTrajectoryResponse {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    alreadyRasterizedJobs: number;
    jobs: QueuedJobNotification[];
}

export interface RasterJobMetadata {
    trajectoryId: string;
    timestep: number;
    analysisId?: string;
    model?: string;
    autoPreview: boolean;
}

export interface RasterQueueJobPayload extends JobIdentity {
    trajectoryId: string;
    timestep: number;
    modelObjectKey: string;
    modelOwnerClusterId: string;
    outputObjectKey: string;
    outputOwnerClusterId: string;
    status: string;
    queueType: string;
    metadata: RasterJobMetadata;
    createdAt: string;
    updatedAt: string;
}

export interface GlbConversionQueueJobPayload extends JobIdentity {
    trajectoryId: string;
    timestep: number;
    objectKey: string;
    ownerClusterId: string;
    status: string;
    queueType: string;
    metadata: {
        trajectoryId: string;
        timestep: number;
    };
    createdAt: string;
    updatedAt: string;
}

interface EnqueuePreprocessingFrame {
    timestep: number;
    objectKey: string;
    ownerClusterId?: string;
}

export interface EnqueuePreprocessingRequest {
    trajectoryId: string;
    teamId: string;
    storageClusterId: string;
    frames: EnqueuePreprocessingFrame[];
}

export interface EnqueuePreprocessingResponse {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
}

export interface TrajectoryRuntimeCleanupRequest {
    trajectoryId: string;
    analysisIds?: string[];
    jobIds?: string[];
}

export interface FrameProcessingQueueJobPayload extends JobIdentity {
    trajectoryId: string;
    timestep: number;
    stagingObjectKey: string;
    ownerClusterId: string;
    status: string;
    queueType: string;
    metadata: {
        trajectoryId: string;
        timestep: number;
    };
    createdAt: string;
    updatedAt: string;
}
