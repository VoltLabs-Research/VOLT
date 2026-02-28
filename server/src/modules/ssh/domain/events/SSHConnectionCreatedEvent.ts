import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface SSHConnectionCreatedEventPayload {
    sshConnectionId: string;
    teamId: string;
    name: string;
}

export default class SSHConnectionCreatedEvent implements IDomainEvent {
    public readonly name = 'ssh-connection.created';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: SSHConnectionCreatedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
