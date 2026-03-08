import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface TrajectoryCreatedEventPayload {
    trajectoryId: string;
    trajectoryName: string;
    teamId: string;
    userId: string;
}

export default class TrajectoryCreatedEvent extends BaseDomainEvent<TrajectoryCreatedEventPayload> {
    constructor(payload: TrajectoryCreatedEventPayload) {
        super('trajectory.created', payload);
    }
}
