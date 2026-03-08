import { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface SessionFailureSummary {
    failedJobs: number;
    lastFailure?: WorkerFailureEnvelope;
}

export interface SessionCompletedEventPayload {
    sessionId: string;
    teamId: string;
    queueType: string;
    totalJobs: number;
    startTime: Date;
    completedAt: Date;
    metadata?: Record<string, unknown>;
    failureSummary?: SessionFailureSummary;
}

export default class SessionCompletedEvent extends BaseDomainEvent<SessionCompletedEventPayload> {
    constructor(payload: SessionCompletedEventPayload) {
        super('session.completed', payload);
    }
}
