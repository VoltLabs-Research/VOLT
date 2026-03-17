import { forceGC, isMemoryPressured } from '@/core/memory';
import { logger } from '@/core/logger';
import { ANALYSIS_EXPOSURE_PROCESSING_QUEUE_NAME } from '@/modules/platform/services';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { ResultProcessorService } from './ResultProcessorService';
import type { AnalysisExposureProcessingJobPayload } from './AnalysisExposureProcessingDispatchService';
import { DelayedError, type Job, type Worker } from 'bullmq';

export interface AnalysisExposureProcessingJobResult {
    exposureId: string;
};

export class AnalysisExposureProcessingWorkerService {
    private worker: Worker<AnalysisExposureProcessingJobPayload, AnalysisExposureProcessingJobResult> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly resultProcessorService: ResultProcessorService
    ) {
    }

    start(concurrency?: number): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<AnalysisExposureProcessingJobPayload, AnalysisExposureProcessingJobResult>(
            ANALYSIS_EXPOSURE_PROCESSING_QUEUE_NAME,
            async (jobPayload, job) => this.processJob(jobPayload, job),
            {
                concurrency: concurrency ?? 2,
                lockDurationMs: 120_000
            }
        );

        this.worker.on('failed', (job, error) => {
            logger.error(
                {
                    err: error,
                    exposureId: job?.data?.exposure?.nodeId,
                    jobId: job?.data?.jobId,
                    parentJobId: job?.data?.parentJobId
                },
                'BullMQ analysis exposure processing job failed'
            );
        });

        logger.info('AnalysisExposureProcessingWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('AnalysisExposureProcessingWorkerService stopped');
    }

    private async processJob(
        job: AnalysisExposureProcessingJobPayload,
        bullJob: Job<AnalysisExposureProcessingJobPayload>
    ): Promise<AnalysisExposureProcessingJobResult> {
        if (isMemoryPressured()) {
            const delayMs = 15_000;
            logger.warn(
                {
                    delayMs,
                    exposureId: job.exposure.nodeId,
                    jobId: job.jobId,
                    parentJobId: job.parentJobId
                },
                'Heap memory pressure detected — delaying exposure processing job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const runningTimestamp = new Date().toISOString();

        try {
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'running',
                updatedAt: runningTimestamp,
                timestamp: runningTimestamp
            });

            await this.resultProcessorService.processExposureResult(
                job.executionData,
                job.exposure,
                job.outputDir,
                job.timestep,
                job.teamId
            );
            forceGC();

            const completedTimestamp = new Date().toISOString();
            await this.redisConnectionService.projectJobStatus({
                ...job,
                status: 'completed',
                updatedAt: completedTimestamp,
                timestamp: completedTimestamp
            });

            return {
                exposureId: job.exposure.nodeId
            };
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                throw error;
            }

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
