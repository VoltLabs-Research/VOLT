import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

export interface JobFailedEventPayload {
    jobId: string;
    teamId: string;
    queueType: string;
    error: string;
    failure: WorkerFailureEnvelope;
    metadata?: Record<string, unknown>;
    failedAt: Date;
}

export default class JobFailedEvent extends BaseDomainEvent<JobFailedEventPayload> {
    constructor(payload: JobFailedEventPayload) {
        super('job.failed', payload);
    }
}
