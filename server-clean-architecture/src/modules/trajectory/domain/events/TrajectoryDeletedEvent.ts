import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface TrajectoryDeletedEventPayload{
    trajectoryId: string;
    teamId: string;
};

export default class TrajectoryDeletedEvent implements IDomainEvent{
    public readonly name = 'trajectory.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: TrajectoryDeletedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};
