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
        const jobs = input.frames.map((frame) => buildGlbJobPayload(input, frame));
        const enqueueResult = await queueService.enqueueMany(TRAJECTORY_GLB_QUEUE_NAME, jobs, {
            preserveExistingJob: true
        });

        await Promise.all(enqueueResult.enqueuedPayloads.map((job) => redisConnectionService.projectJobStatus(job)));

        return {
            queuedJobs: enqueueResult.enqueuedPayloads.length,
            duplicateJobs: enqueueResult.skippedPayloads.length
        } satisfies EnqueueGlbJobsResult;
    }
});
