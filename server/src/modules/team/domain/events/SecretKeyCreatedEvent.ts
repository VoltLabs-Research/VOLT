import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface SecretKeyCreatedEventPayload {
    secretKeyId: string;
    teamId: string;
    name: string;
}

export default class SecretKeyCreatedEvent implements IDomainEvent {
    public readonly name = 'secret-key.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: SecretKeyCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
