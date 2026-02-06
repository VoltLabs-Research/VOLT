import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface UserCreatedEventPayload {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
};

export default class UserCreatedEvent implements IDomainEvent {
    public readonly name = 'user.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: UserCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
