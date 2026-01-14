import { injectable, inject } from 'tsyringe';
import Job, { JobStatus } from '../../domain/entities/Job';
import { IJobHandlerService } from '../../domain/ports/IJobHandlerService';
import { IJobRepository } from '../../domain/ports/IJobRepository';
import { SHARED_TOKENS } from '../../../../shared/infrastructure/di/SharedTokens';
import { IEventBus } from '../../../../shared/application/events/IEventBus';
import { JOBS_TOKENS } from './di/JobsTokens';
import JobStatusChangedEvent from '../../application/events/JobStatusChangedEvent';
import JobCompletedEvent from '../../application/events/JobCompletedEvent';
import JobFailedEvent from '../../application/events/JobFailedEvent';
import JobIncrementedEvent from '../../application/events/JobIncrementedEvent';

export interface JobHandlerConfig{
    queueName: string;
    statusKeyPrefix: string;
    ttlSeconds: number;
};

@injectable()
export default class JobHandlerService implements IJobHandlerService{
    private config!: JobHandlerConfig;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ){}

    initialize(config: JobHandlerConfig): void{
        this.config = config;
    }

    async setJobStatus(
        jobId: string, 
        status: JobStatus, 
        data: any
    ): Promise<void>{
        const statusData = {
            jobId,
            status,
            queueType: this.config.queueName,
            ...data
        };

        const statusKey = `${this.config.statusKeyPrefix}${jobId}`;
        const teamId = data.teamId;

        await this.jobRepository.setJobStatus(statusKey, statusData, this.config.ttlSeconds);
        if(teamId){
            await this.jobRepository.addToTeamJobs(teamId, jobId);
        }

        const event = new JobStatusChangedEvent({
            jobId,
            teamId,
            status,
            queueType: this.config.queueName,
            metadata: data.metadata
        });

        await this.eventBus.publish(event);
    }

    async getJobStatus(jobId: string): Promise<any | null>{
        const statusKey = `${this.config.statusKeyPrefix}${jobId}`;
        try{
            return await this.jobRepository.getJobStatus(statusKey);
        }catch{
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
        if(status === JobStatus.Completed){
            const event = new JobCompletedEvent({
                jobId: job.props.jobId,
                teamId: job.props.teamId,
                queueType: job.props.queueType,
                metadata: job.props.metadata,
                completedAt: new Date()
            });
            await this.eventBus.publish(event);
        }else if(status === JobStatus.Failed){
            const event = new JobFailedEvent({
                jobId: job.props.jobId,
                teamId: job.props.teamId,
                queueType: job.props.queueType,
                error: job.props.error || 'Unknown error',
                metadata: job.props.metadata,
                failedAt: new Date()
            });
            await this.eventBus.publish(event);
        }
    }

    async trackJobIncrement(job: Job, sessionId: string): Promise<void>{
        const event = new JobIncrementedEvent({
            jobId: job.props.jobId,
            teamId: job.props.teamId,
            queueType: job.props.queueType,
            sessionId,
            metadata: job.props.metadata
        });

        await this.eventBus.publish(event);
    }
};