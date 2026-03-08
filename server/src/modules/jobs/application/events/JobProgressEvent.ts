import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface JobProgressEventPayload {
    jobId: string;
    teamId: string;
    queueType: string;
    progress: number;
    message?: string;
    metadata?: Record<string, unknown>;
}

export default class JobProgressEvent extends BaseDomainEvent<JobProgressEventPayload> {
    constructor(payload: JobProgressEventPayload) {
        super('job.progress', payload);
    }
}
