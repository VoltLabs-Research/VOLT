import { logger } from '@/core/logger';
import { isMemoryPressured } from '@/core/memory';
import { TRAJECTORY_ARTIFACT_EXPORT_QUEUE_NAME } from '@/modules/platform/services';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { FilterEvaluatorService } from './FilterEvaluatorService';
import type {
    NativeColorModelRequest,
    NativeFilterPreviewRequest,
    NativeFilterPreviewResponse,
    NativeParticleFilterModelRequest
} from './NativeModuleLoader';
import { DelayedError, type Job, type Worker } from 'bullmq';

export enum TrajectoryArtifactExportJobType {
    ColorModel = 'color-model',
    FilterPreview = 'filter-preview',
    ParticleFilterModel = 'particle-filter-model'
}

export interface TrajectoryArtifactExportJobPayload extends Record<string, unknown> {
    jobId: string;
    teamId?: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep: number;
    queueType: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    createdAt: string;
    updatedAt: string;
    type: TrajectoryArtifactExportJobType;
    request: NativeColorModelRequest | NativeFilterPreviewRequest | NativeParticleFilterModelRequest;
};

export type TrajectoryArtifactExportJobResult =
    | NativeFilterPreviewResponse
    | { objectKey: string; }
    | { objectKey: string; atomsResult: number; };

export class TrajectoryArtifactExportWorkerService {
    private worker: Worker<TrajectoryArtifactExportJobPayload, TrajectoryArtifactExportJobResult> | null = null;

    constructor(
        private readonly queueService: QueueService,
        private readonly redisConnectionService: RedisConnectionService,
        private readonly filterEvaluatorService: FilterEvaluatorService
    ) {
    }

    start(concurrency?: number): void {
        if (this.worker) {
            return;
        }

        this.worker = this.queueService.createWorker<TrajectoryArtifactExportJobPayload, TrajectoryArtifactExportJobResult>(
            TRAJECTORY_ARTIFACT_EXPORT_QUEUE_NAME,
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
                    jobId: job?.data?.jobId,
                    trajectoryId: job?.data?.trajectoryId,
                    type: job?.data?.type
                },
                'BullMQ trajectory artifact export job failed'
            );
        });

        logger.info('TrajectoryArtifactExportWorkerService started');
    }

    async stop(): Promise<void> {
        if (!this.worker) {
            return;
        }

        await this.worker.close();
        this.worker = null;
        logger.info('TrajectoryArtifactExportWorkerService stopped');
    }

    private async processJob(
        job: TrajectoryArtifactExportJobPayload,
        bullJob: Job<TrajectoryArtifactExportJobPayload>
    ): Promise<TrajectoryArtifactExportJobResult> {
        if (isMemoryPressured()) {
            const delayMs = 15_000;
            logger.warn(
                {
                    delayMs,
                    jobId: job.jobId,
                    trajectoryId: job.trajectoryId,
                    type: job.type
                },
                'Heap memory pressure detected — delaying trajectory artifact export job'
            );
            await bullJob.moveToDelayed(Date.now() + delayMs, bullJob.token);
            throw new DelayedError();
        }

        const runningTimestamp = new Date().toISOString();

        try {
            await this.projectJobStatus(job, 'running', runningTimestamp);

            if (job.type === TrajectoryArtifactExportJobType.FilterPreview) {
                const result = await this.filterEvaluatorService.previewFilterInline(job.request as NativeFilterPreviewRequest);
                const completedTimestamp = new Date().toISOString();
                await this.projectJobStatus(job, 'completed', completedTimestamp);
                return result;
            }

            if (job.type === TrajectoryArtifactExportJobType.ColorModel) {
                const result = await this.filterEvaluatorService.exportColoredModelInline(job.request as NativeColorModelRequest);
                const completedTimestamp = new Date().toISOString();
                await this.projectJobStatus(job, 'completed', completedTimestamp);
                return result;
            }

            const result = await this.filterEvaluatorService.exportParticleFilterModelInline(job.request as NativeParticleFilterModelRequest);
            const completedTimestamp = new Date().toISOString();
            await this.projectJobStatus(job, 'completed', completedTimestamp);
            return result;
        } catch (error: unknown) {
            if (error instanceof DelayedError) {
                throw error;
            }

            const message = error instanceof Error ? error.message : String(error);
            const failedTimestamp = new Date().toISOString();
            await this.projectJobStatus(job, 'failed', failedTimestamp, message);
            throw error instanceof Error ? error : new Error(message);
        }
    }

    private async projectJobStatus(
        job: TrajectoryArtifactExportJobPayload,
        status: 'running' | 'completed' | 'failed',
        timestamp: string,
        error?: string
    ): Promise<void> {
        if (!job.teamId) {
            return;
        }

        await this.redisConnectionService.projectJobStatus({
            ...job,
            teamId: job.teamId,
            status,
            error,
            updatedAt: timestamp,
            timestamp,
            metadata: {
                type: job.type
            }
        });
    }
}
