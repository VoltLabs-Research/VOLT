import { BaseDomainEvent } from '@shared/domain/events/BaseDomainEvent';

export interface UserDeletedEventPayload {
    userId: string;
}

export default class UserDeletedEvent extends BaseDomainEvent<UserDeletedEventPayload> {
    constructor(payload: UserDeletedEventPayload) {
        super('user.deleted', payload);
    }
}
