import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TrajectoryCreatedEventPayload {
    trajectoryId: string;
    trajectoryName: string;
    teamId: string;
    userId: string;
}

export default class TrajectoryCreatedEvent implements IDomainEvent {
    public readonly name = 'trajectory.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TrajectoryCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
