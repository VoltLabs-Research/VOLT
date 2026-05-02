import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface UserCreatedEventPayload {
    userId: string;
    id: string;
    email: string;
    firstName: string;
    lastName: string;
}

export default class UserCreatedEvent extends BaseDomainEvent<UserCreatedEventPayload> {
    constructor(payload: UserCreatedEventPayload) {
        super('user.created', payload);
    }
}
