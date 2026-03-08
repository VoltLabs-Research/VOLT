import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { getWorkerFailureErrorMessage } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import Job from '@modules/jobs/domain/entities/Job';
import JobCompletedEvent from '@modules/jobs/domain/events/JobCompletedEvent';
import JobFailedEvent from '@modules/jobs/domain/events/JobFailedEvent';
import JobIncrementedEvent from '@modules/jobs/domain/events/JobIncrementedEvent';
import JobProgressEvent from '@modules/jobs/domain/events/JobProgressEvent';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import JobsAddedEvent from '@modules/jobs/domain/events/JobsAddedEvent';
import SessionCompletedEvent from '@modules/jobs/domain/events/SessionCompletedEvent';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { QueueJobData, SessionCompletedSnapshot } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';
import type { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

export default class ProcessingQueueEventPublisher {
    constructor(
        private readonly eventBus: IEventBus,
        private readonly queueName: string
    ) {}

    async publishQueuedJobs(jobs: Job[], sessionId: string): Promise<void> {
        for (const job of jobs) {
            const incrementEvent = new JobIncrementedEvent({
                jobId: job.props.jobId,
                teamId: job.props.teamId,
                queueType: job.props.queueType,
                sessionId,
                metadata: { ...job.props }
            });
            await this.eventBus.publish(incrementEvent);
        }
    }

    async publishJobsAdded(firstJob: Job, sessionId: string, count: number): Promise<void> {
        let metadata: Record<string, unknown> | undefined;
        if (isRecord(firstJob.props.metadata)) {
            metadata = firstJob.props.metadata;
        }

        const addedEvent = new JobsAddedEvent({
            sessionId,
            queueType: this.queueName,
            teamId: firstJob.props.teamId,
            count,
            metadata
        });

        await this.eventBus.publish(addedEvent);
    }

    async publishStatusChanged(
        jobId: string,
        teamId: string,
        status: JobStatus,
        metadata: Record<string, unknown>
    ): Promise<void> {
        const event = new JobStatusChangedEvent({
            jobId,
            teamId,
            status,
            queueType: this.queueName,
            metadata
        });

        await this.eventBus.publish(event);
    }

    async publishProgress(jobData: QueueJobData, progress: number, message?: string): Promise<void> {
        let metadata: Record<string, unknown> | undefined;
        if (isRecord(jobData.metadata)) {
            metadata = jobData.metadata;
        }

        const event = new JobProgressEvent({
            jobId: String(jobData.jobId),
            teamId: String(jobData.teamId),
            queueType: this.queueName,
            progress,
            message,
            metadata
        });

        await this.eventBus.publish(event);
    }

    async publishCompleted(jobData: QueueJobData): Promise<void> {
        const event = new JobCompletedEvent({
            jobId: String(jobData.jobId),
            teamId: String(jobData.teamId),
            queueType: this.queueName,
            metadata: { ...jobData },
            completedAt: new Date()
        });

        await this.eventBus.publish(event);
    }

    async publishFailed(jobData: QueueJobData, failure: WorkerFailureEnvelope): Promise<void> {
        const event = new JobFailedEvent({
            jobId: String(jobData.jobId),
            teamId: String(jobData.teamId),
            queueType: this.queueName,
            error: getWorkerFailureErrorMessage(failure),
            failure,
            metadata: { ...jobData },
            failedAt: new Date()
        });

        await this.eventBus.publish(event);
    }

    async publishSessionCompleted(snapshot: SessionCompletedSnapshot): Promise<void> {
        await this.eventBus.publish(new SessionCompletedEvent(snapshot));
    }
};
