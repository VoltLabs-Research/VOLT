import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface SecretKeyDeletedEventPayload {
    secretKeyId: string;
    teamId: string;
}

export default class SecretKeyDeletedEvent implements IDomainEvent {
    public readonly name = 'secret-key.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: SecretKeyDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
