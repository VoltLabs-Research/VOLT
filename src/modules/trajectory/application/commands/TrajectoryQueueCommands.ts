import type { EnqueuePreprocessingRequest, EnqueuePreprocessingResponse, GlbConversionQueueJobPayload, RasterizeTrajectoryRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import { logger } from '@/core/logger';
import type { QueueService } from '@/core/queues/application/QueueService';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { TrajectoryRasterQueue } from '@/modules/trajectory/application/raster/TrajectoryRasterQueue';

@CommandGroup('trajectory')
export class TrajectoryQueueCommands {
    constructor(
        private readonly trajectoryRasterQueue: TrajectoryRasterQueue,
        private readonly queueService: QueueService
    ) {}

    @Command('rasterize')
    rasterize(payload: RasterizeTrajectoryRequest) {
        return this.trajectoryRasterQueue.queueRasterizationJobs(payload);
    }

    @Command('enqueue-preprocessing')
    async enqueuePreprocessing(payload: EnqueuePreprocessingRequest) {
        const result: EnqueuePreprocessingResponse = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0
        };
        const jobsToEnqueue: GlbConversionQueueJobPayload[] = [];

        for (const frame of payload.frames) {
            const ownerClusterId = frame.ownerClusterId || payload.storageClusterId;

            if (!ownerClusterId) {
                logger.debug(
                    {
                        objectKey: frame.objectKey,
                        timestep: frame.timestep,
                        trajectoryId: payload.trajectoryId
                    },
                    'Skipping GLB enqueue — dump owner cluster is missing'
                );
                result.skippedJobs += 1;
                continue;
            }

            const timestamp = new Date().toISOString();
            jobsToEnqueue.push({
                jobId: `trajectory-glb:${payload.trajectoryId}:${frame.timestep}`,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                timestep: frame.timestep,
                objectKey: frame.objectKey,
                ownerClusterId,
                status: 'queued',
                queueType: TRAJECTORY_GLB_QUEUE_NAME,
                metadata: {
                    trajectoryId: payload.trajectoryId,
                    timestep: frame.timestep
                },
                createdAt: timestamp,
                updatedAt: timestamp
            });
        }

        if (jobsToEnqueue.length > 0) {
            await this.queueService.enqueueBulk(TRAJECTORY_GLB_QUEUE_NAME, jobsToEnqueue);
            result.queuedJobs = jobsToEnqueue.length;
        }

        return result;
    }
}
