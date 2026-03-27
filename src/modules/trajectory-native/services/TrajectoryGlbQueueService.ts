import { TRAJECTORY_GLB_QUEUE_NAME } from '@/modules/platform/services';
import { logger } from '@/core/logger';
import type { QueueService } from '@/modules/platform/services';
import type {
    EnqueuePreprocessingRequest,
    EnqueuePreprocessingResponse,
    EnqueuePreprocessingFrameDescriptor,
    GlbConversionQueueJobPayload,
    QueuedJobNotification
} from '@/shared/contracts';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

interface EnqueueGlbJobsResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
    jobs: QueuedJobNotification[];
};

const buildGlbJobId = (trajectoryId: string, timestep: number): string => {
    return `trajectory-glb:${trajectoryId}:${timestep}`;
};

const buildGlbJobPayload = (
    input: EnqueuePreprocessingRequest,
    frame: EnqueuePreprocessingFrameDescriptor
): GlbConversionQueueJobPayload => {
    const timestamp = new Date().toISOString();

    return {
        jobId: buildGlbJobId(input.trajectoryId, frame.timestep),
        teamId: input.teamId,
        trajectoryId: input.trajectoryId,
        trajectoryName: input.trajectoryName,
        timestep: frame.timestep,
        objectKey: frame.objectKey,
        ownerClusterId: frame.ownerClusterId || input.storageClusterId,
        status: 'queued',
        queueType: TRAJECTORY_GLB_QUEUE_NAME,
        metadata: {
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            timestep: frame.timestep
        },
        createdAt: timestamp,
        updatedAt: timestamp
    };
};

export interface TrajectoryGlbQueueService {
    enqueueGlbConversionJobs(input: EnqueuePreprocessingRequest): Promise<EnqueuePreprocessingResponse>;
};

export const createTrajectoryGlbQueueService = (
    _objectStore: ClusterObjectStore,
    queueService: QueueService
): TrajectoryGlbQueueService => ({
    async enqueueGlbConversionJobs(input) {
        const result: EnqueueGlbJobsResult = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0,
            jobs: []
        };

        for (const frame of input.frames) {
            const ownerClusterId = frame.ownerClusterId || input.storageClusterId;

            if (!ownerClusterId) {
                logger.debug(
                    {
                        objectKey: frame.objectKey,
                        timestep: frame.timestep,
                        trajectoryId: input.trajectoryId
                    },
                    'Skipping GLB enqueue — dump owner cluster is missing'
                );
                result.skippedJobs += 1;
                continue;
            }

            const job = buildGlbJobPayload(input, {
                ...frame,
                ownerClusterId
            });
            const wasEnqueued = await queueService.enqueue(TRAJECTORY_GLB_QUEUE_NAME, job, {
                preserveExistingJob: true
            });

            if (!wasEnqueued) {
                result.duplicateJobs += 1;
                continue;
            }

            result.queuedJobs += 1;
            result.jobs.push({
                jobId: job.jobId,
                name: 'Preprocess trajectory frame',
                teamId: job.teamId,
                timestep: job.timestep,
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                queueType: TRAJECTORY_GLB_QUEUE_NAME
            });
        }

        return result;
    }
});
