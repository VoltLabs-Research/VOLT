import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';
import type { JobStatusChangedValue, JobStatusChangedMetadata } from './JobStatusChangedEvent';

export type TeamJobProjectedStatus = JobStatusChangedValue | 'partial';

export interface TeamJobProjectedEventPayload {
    jobId: string;
    teamId: string;
    queueType: string;
    status: TeamJobProjectedStatus;
    metadata?: JobStatusChangedMetadata;
    timestamp?: string;
    createdAt?: string;
    updatedAt?: string;
    name?: string;
    message?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    teamClusterId?: string;
    source?: string;
    backingSource?: string;
    cleanupScope?: string;
}

export default class TeamJobProjectedEvent extends BaseDomainEvent<TeamJobProjectedEventPayload> {
    constructor(payload: TeamJobProjectedEventPayload) {
        super('job.team.projected', payload);
    }
}
