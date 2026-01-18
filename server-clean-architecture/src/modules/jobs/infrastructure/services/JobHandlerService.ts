import { injectable, inject } from 'tsyringe';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IJobHandlerService } from '@modules/jobs/domain/ports/IJobHandlerService';
import { IJobRepository } from '@modules/jobs/domain/ports/IJobRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import JobStatusChangedEvent from '@modules/jobs/application/events/JobStatusChangedEvent';
import JobCompletedEvent from '@modules/jobs/application/events/JobCompletedEvent';
import JobFailedEvent from '@modules/jobs/application/events/JobFailedEvent';
import JobIncrementedEvent from '@modules/jobs/application/events/JobIncrementedEvent';

export interface JobHandlerConfig {
    queueName: string;
    statusKeyPrefix: string;
    ttlSeconds: number;
};

@injectable()
export default class JobHandlerService implements IJobHandlerService {
    private config!: JobHandlerConfig;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    initialize(config: JobHandlerConfig): void {
        this.config = config;
    }

    async setJobStatus(
        jobId: string,
        status: JobStatus,
        data: any
    ): Promise<void> {
        // Expand metadata fields to root level for Redis storage
        const statusData = {
            jobId,
            status,
            timestamp: new Date().toISOString(),
            queueType: this.config.queueName,
            ...data,
            // Explicitly include metadata fields at root level
            ...(data.metadata || {})
        };

        const statusKey = `${this.config.statusKeyPrefix}${jobId}`;
        const teamId = data.teamId;

        await this.jobRepository.setJobStatus(statusKey, statusData, this.config.ttlSeconds);
        if (teamId) {
            await this.jobRepository.addToTeamJobs(teamId, jobId);
        }

        const event = new JobStatusChangedEvent({
            jobId,
            teamId,
            status,
            queueType: this.config.queueName,
            metadata: statusData
        });

        await this.eventBus.publish(event);
    }

    async getJobStatus(jobId: string): Promise<any | null> {
        const statusKey = `${this.config.statusKeyPrefix}${jobId}`;
        try {
            return await this.jobRepository.getJobStatus(statusKey);
        } catch {
            return null;
        }
    }

    async handleJobFailure(
        job: Job,
        error: string,
        rawData: string,
        queueKey: string
    ): Promise<boolean> {
        const maxAttempts = job.props.maxRetries || 1;
        const retryCountKey = `job:retries:${job.props.jobId}`;

        await this.jobRepository.incrementRetryCounter(
            retryCountKey,
            this.config.ttlSeconds
        );

        const statusKey = `${this.config.statusKeyPrefix}${job.props.jobId}`;
        await this.jobRepository.deleteJobStatus(statusKey);
        await this.jobRepository.deleteRetryCounter(retryCountKey);

        return true;
    }

    async trackJobCompletion(job: Job, status: JobStatus): Promise<void> {
        if (status === JobStatus.Completed) {
            const event = new JobCompletedEvent({
                jobId: job.props.jobId,
                teamId: job.props.teamId,
                queueType: job.props.queueType,
                metadata: job.props,
                completedAt: new Date()
            });
            await this.eventBus.publish(event);
        } else if (status === JobStatus.Failed) {
            const event = new JobFailedEvent({
                jobId: job.props.jobId,
                teamId: job.props.teamId,
                queueType: job.props.queueType,
                error: job.props.error || 'Unknown error',
                metadata: job.props,
                failedAt: new Date()
            });
            await this.eventBus.publish(event);
        }
    }

    async trackJobIncrement(job: Job, sessionId: string): Promise<void> {
        const event = new JobIncrementedEvent({
            jobId: job.props.jobId,
            teamId: job.props.teamId,
            queueType: job.props.queueType,
            sessionId,
            metadata: job.props
        });

        await this.eventBus.publish(event);
    }

    async cancelJob(trajectoryId: string, jobId: string): Promise<void> {
        // Job queue integration placeholder
        console.log(`Cancelling job ${jobId} for trajectory ${trajectoryId}`);
    }

    async retryFailedJobs(trajectoryId: string): Promise<number> {
        // Retry logic placeholder
        return 0;
    }
};