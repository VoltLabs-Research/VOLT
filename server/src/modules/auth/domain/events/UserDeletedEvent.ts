import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface UserDeletedEventPayload {
    userId: string;
}

export default class UserDeletedEvent extends BaseDomainEvent<UserDeletedEventPayload> {
    constructor(payload: UserDeletedEventPayload) {
        super('user.deleted', payload);
    }
}
