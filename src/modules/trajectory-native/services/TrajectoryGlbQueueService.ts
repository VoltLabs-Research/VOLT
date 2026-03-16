import { TRAJECTORY_GLB_QUEUE_NAME } from '@/modules/platform/services';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type {
    EnqueuePreprocessingRequest,
    EnqueuePreprocessingResponse,
    EnqueuePreprocessingFrameDescriptor,
    GlbConversionQueueJobPayload
} from '@/shared/contracts';

interface EnqueueGlbJobsResult {
    queuedJobs: number;
    duplicateJobs: number;
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
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): TrajectoryGlbQueueService => ({
    async enqueueGlbConversionJobs(input) {
        const result: EnqueueGlbJobsResult = {
            queuedJobs: 0,
            duplicateJobs: 0
        };

        for (const frame of input.frames) {
            const job = buildGlbJobPayload(input, frame);
            const wasEnqueued = await queueService.enqueue(TRAJECTORY_GLB_QUEUE_NAME, job, {
                preserveExistingJob: true
            });

            if (!wasEnqueued) {
                result.duplicateJobs += 1;
                continue;
            }

            await redisConnectionService.projectJobStatus(job);
            result.queuedJobs += 1;
        }

        return result;
    }
});
