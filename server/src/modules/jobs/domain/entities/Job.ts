import { asRecord } from '@shared/infrastructure/utilities/type-guards';
import { v4 } from 'uuid';

export type JobMetadataValue = unknown;
export type JobMetadata = unknown;

export interface JobData {
    jobId: string;
    teamId: string;
    sessionId?: string;
    status: JobStatus;
    queueType: string;
    maxRetries?: number;
    metadata?: JobMetadata;
    completedAt?: Date;
    error?: string;
    startTime?: Date;
    progress?: number;
    message?: string;
    workerId?: number;
    createdAt: Date;
    updatedAt: Date;
};

export enum JobStatus {
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
};

export default class Job {
    constructor(
        public props: JobData
    ) {}

    static create(data: Partial<JobData>): Job {
        return new Job({
            jobId: data.jobId || v4(),
            teamId: data.teamId!,
            queueType: data.queueType!,
            status: data.status || JobStatus.Queued,
            sessionId: data.sessionId,
            metadata: data.metadata || {},
            completedAt: data.completedAt,
            error: data.error,
            maxRetries: data.maxRetries || 1,
            startTime: data.startTime,
            message: data.message,
            createdAt: data.createdAt || new Date(),
            updatedAt: data.updatedAt || new Date(),
            progress: data.progress,
            workerId: data.workerId
        });
    }

    getMetadata(key: string): JobMetadataValue | undefined {
        return asRecord(this.props.metadata)?.[key];
    }

    setMetadata(key: string, value: JobMetadataValue): void {
        let metadata = asRecord(this.props.metadata);
        if (!metadata) {
            metadata = {};
            this.props.metadata = metadata;
        }

        metadata[key] = value;
    }

    markAsRunning(workerId: number): void {
        this.props.status = JobStatus.Running;
        this.props.workerId = workerId;
        this.props.updatedAt = new Date();
        this.props.startTime = new Date();
    }

    markAsCompleted(): void {
        this.props.status = JobStatus.Completed;
        this.props.completedAt = new Date();
        this.props.updatedAt = new Date();
    }

    markAsFailed(error: string): void {
        this.props.status = JobStatus.Failed;
        this.props.error = error;
        this.props.completedAt = new Date();
        this.props.updatedAt = new Date();
    }
};
