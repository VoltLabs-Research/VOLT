import { singleton } from '@shared/application/utilities/singleton';
import { logger } from '@shared/infrastructure/logger';
import { QueueService, getQueueService } from '@shared/infrastructure/queues/QueueService';
import { ANALYSIS_QUEUE_NAME } from '@core/constants/queue-names';
import { DaemonStateStore, getDaemonStateStore } from '@shared/infrastructure/persistence/DaemonStateStore';
import type { AnalysisQueueJobPayload } from '@shared/contracts/types/http-analysis';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

const ANALYSIS_QUEUE_ADMISSION_TTL_SECONDS = 86_400;
const DEFAULT_ANALYSIS_QUEUE_ADMISSION_WINDOW = readPositiveIntegerEnv('ANALYSIS_QUEUE_ADMISSION_WINDOW') ?? 64;
const REMOVED_ANALYSIS_JOB_TOMBSTONE_PREFIX = 'analysis:removed-job:';

interface QueueAdmissionResult {
    queuedJobs: AnalysisQueueJobPayload[];
    deferredJobs: number;
}

export class AnalysisQueueAdmissionController {
    private readonly admissionWindow = Math.max(1, DEFAULT_ANALYSIS_QUEUE_ADMISSION_WINDOW);

    constructor(
        private readonly queueService: QueueService,
        private readonly stateStore: DaemonStateStore
    ) {}

    async enqueueInitialJobs(jobs: AnalysisQueueJobPayload[]): Promise<QueueAdmissionResult> {
        if (jobs.length === 0) {
            return {
                queuedJobs: [],
                deferredJobs: 0
            };
        }

        const analysisId = jobs[0]?.analysisId;
        if (!analysisId) {
            throw new Error('Analysis queue admission requires analysisId on queued jobs');
        }

        const queuedJobs = jobs.slice(0, this.admissionWindow);
        const deferredJobs = jobs.slice(this.admissionWindow);

        await this.stateStore.appendListWithTtl(
            this.pendingJobsKey(analysisId),
            deferredJobs.map((job) => JSON.stringify(job)),
            ANALYSIS_QUEUE_ADMISSION_TTL_SECONDS
        );
        await this.queueService.enqueueBulk(ANALYSIS_QUEUE_NAME, queuedJobs);

        return {
            queuedJobs,
            deferredJobs: deferredJobs.length
        };
    }

    async enqueueNextDeferredJob(analysisId: string): Promise<AnalysisQueueJobPayload | null> {
        while (true) {
            const deferredPayload = await this.stateStore.popListHead(this.pendingJobsKey(analysisId));
            if (!deferredPayload) {
                return null;
            }

            let job: AnalysisQueueJobPayload;
            try {
                job = JSON.parse(deferredPayload) as AnalysisQueueJobPayload;
            } catch (error) {
                logger.error(
                    {
                        err: error,
                        analysisId
                    },
                    '@analysis-queue-admission: failed to parse deferred analysis job payload'
                );
                continue;
            }

            if (await this.isRemovedJob(job.jobId)) {
                continue;
            }

            await this.queueService.enqueue(ANALYSIS_QUEUE_NAME, job);
            return job;
        }
    }

    private pendingJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:pending-jobs`;
    }

    private async isRemovedJob(jobId: string): Promise<boolean> {
        return (await this.stateStore.getValue(`${REMOVED_ANALYSIS_JOB_TOMBSTONE_PREFIX}${jobId}`)) === '1';
    }
}

export const getAnalysisQueueAdmissionController = singleton((): AnalysisQueueAdmissionController => new AnalysisQueueAdmissionController(getQueueService(), getDaemonStateStore()));
