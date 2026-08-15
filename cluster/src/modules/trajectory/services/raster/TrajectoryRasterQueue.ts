import { toTrajectoryFrameModelObjectKey } from '@shared/infrastructure/storage/storage-codec';
import { singleton } from '@shared/application/utilities/singleton';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getTrajectoryAutoPreviewClaimStore } from '@modules/trajectory/services/storage/TrajectoryAutoPreviewClaimStore';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type { RasterizeTrajectoryRequest, RasterizeTrajectoryResponse } from '@shared/contracts/types/queue-trajectory';
import type { TrajectoryAutoPreviewClaimStore } from '@modules/trajectory/services/storage/TrajectoryAutoPreviewClaimStore';
import { buildRasterJobPayload } from '@modules/trajectory/services/raster-job-factory';
import type { QueuedJobNotification } from '@shared/contracts/types/http-analysis';
import type { JobIdentity } from '@shared/contracts/types/job-identity';

const RASTER_JOB_NAME = 'Rasterize trajectory preview';

interface QueueJobLike extends JobIdentity {
    queueType: string;
}

const toQueuedJobNotification = <TJob extends QueueJobLike>(
    job: TJob,
    name: string
): QueuedJobNotification => ({
    jobId: job.jobId,
    teamId: job.teamId,
    trajectoryId: job.trajectoryId,
    analysisId: job.analysisId,
    pluginId: job.pluginId,
    timestep: job.timestep,
    queueType: job.queueType,
    name
});

export class TrajectoryRasterQueue {
    constructor(
        private readonly queueService: QueueService,
        private readonly trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore
    ) {}

    async queueRasterizationJobs(input: RasterizeTrajectoryRequest): Promise<RasterizeTrajectoryResponse> {
        if (!input.storageClusterId) {
            throw new Error(`Missing storageClusterId for rasterization of trajectory ${input.trajectoryId}`);
        }

        const result: RasterizeTrajectoryResponse = {
            queuedJobs: 0,
            duplicateJobs: 0,
            skippedJobs: 0,
            alreadyRasterizedJobs: 0,
            jobs: []
        };

        const timestep = input.config?.timestep;
        if (typeof timestep !== 'number' || !Number.isFinite(timestep)) {
            result.skippedJobs += 1;
            return result;
        }

        const wasClaimed = await this.trajectoryAutoPreviewClaimStore.claimRasterization(input.trajectoryId);
        if (!wasClaimed) {
            result.skippedJobs += 1;
            result.duplicateJobs += 1;
            return result;
        }

        const job = buildRasterJobPayload(
            input,
            {
                modelObjectKey: toTrajectoryFrameModelObjectKey(input.trajectoryId, timestep),
                outputObjectKey: `trajectory-${input.trajectoryId}/previews/timestep-${timestep}.png`,
                timestep
            },
            { autoPreview: true }
        );

        try {
            const wasEnqueued = await this.queueService.enqueue(TRAJECTORY_RASTER_QUEUE_NAME, job, {
                preserveExistingJob: true
            });

            if (!wasEnqueued) {
                await this.trajectoryAutoPreviewClaimStore.releaseRasterization(input.trajectoryId);
                result.skippedJobs += 1;
                result.duplicateJobs += 1;
                return result;
            }
        } catch (error) {
            await this.trajectoryAutoPreviewClaimStore.releaseRasterization(input.trajectoryId);
            throw error;
        }

        result.queuedJobs += 1;
        result.jobs.push(toQueuedJobNotification(job, RASTER_JOB_NAME));
        return result;
    }
}

export const getTrajectoryRasterQueue = singleton((): TrajectoryRasterQueue => new TrajectoryRasterQueue(getQueueService(), getTrajectoryAutoPreviewClaimStore()));
