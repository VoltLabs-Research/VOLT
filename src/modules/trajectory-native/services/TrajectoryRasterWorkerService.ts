import { logger } from '@/core/logger';
import { TRAJECTORY_RASTER_QUEUE_NAME } from '@/modules/platform/services';
import { ObjectBucketName } from '@/shared/contracts';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { RasterQueueJobPayload } from '@/shared/contracts';
import type { Job, Worker } from 'bullmq';
import type { RasterizerService } from './RasterizerService';

export class TrajectoryRasterWorkerService {
    private worker: Worker<RasterQueueJobPayload> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly rasterizerService: RasterizerService
    ) {}

    start(): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<RasterQueueJobPayload>(
            TRAJECTORY_RASTER_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job)
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    jobId: job?.data?.jobId,
                    err: error
                },
                'BullMQ trajectory raster job failed'
            );
        });

        logger.info('TrajectoryRasterWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('TrajectoryRasterWorkerService stopped');
    }

    private async processJob(job: RasterQueueJobPayload, bullJob: Job<RasterQueueJobPayload>): Promise<void> {
        const runningTimestamp = new Date().toISOString();

        try {
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'running',
                updatedAt: runningTimestamp,
                timestamp: runningTimestamp
            });

            await bullJob.updateProgress(10);
            await this.rasterizerService.rasterizePreview({
                inputBucket: ObjectBucketName.Models,
                inputObjectKey: job.modelObjectKey,
                outputObjectKey: job.outputObjectKey
            });
            await bullJob.updateProgress(100);

            const completedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'completed',
                updatedAt: completedTimestamp,
                timestamp: completedTimestamp
            });
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const failedTimestamp = new Date().toISOString();

            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'failed',
                error: message,
                updatedAt: failedTimestamp,
                timestamp: failedTimestamp
            });

            throw error instanceof Error ? error : new Error(message);
        }
    }
}
