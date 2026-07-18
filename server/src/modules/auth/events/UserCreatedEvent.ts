import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface UserCreatedEventPayload {
    id: string;
    firstName: string;
}

export default class UserCreatedEvent extends BaseDomainEvent<UserCreatedEventPayload> {
    constructor(payload: UserCreatedEventPayload) {
        super('user.created', payload);
    }
}
