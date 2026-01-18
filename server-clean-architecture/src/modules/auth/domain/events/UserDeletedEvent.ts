import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface UserDeletedEventPayload {
    userId: string;
};

export default class UserDeletedEvent implements IDomainEvent {
    public readonly name = 'user.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: UserDeletedEventPayload
    ){
        this.occurredOn = new Date();
        this.eventId = v4();
    }
};
