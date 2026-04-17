import { TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { logger } from '@/core/logger';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { EnqueuePreprocessingRequest, EnqueuePreprocessingResponse, EnqueuePreprocessingFrameDescriptor, GlbConversionQueueJobPayload } from '@/contracts';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';

interface EnqueueGlbJobsResult {
    queuedJobs: number;
    duplicateJobs: number;
    skippedJobs: number;
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
            skippedJobs: 0
        };
        const jobsToEnqueue: GlbConversionQueueJobPayload[] = [];

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
            jobsToEnqueue.push(job);
        }

        if (jobsToEnqueue.length > 0) {
            await queueService.enqueueBulk(TRAJECTORY_GLB_QUEUE_NAME, jobsToEnqueue);
            result.queuedJobs = jobsToEnqueue.length;
        }

        return result;
    }
});
