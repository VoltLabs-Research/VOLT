import { IDomainEvent } from '@shared/application/events/IDomainEvent';
import { v4 } from 'uuid';

export interface SSHConnectionDeletedEventPayload {
    sshConnectionId: string;
    teamId: string;
}

export default class SSHConnectionDeletedEvent implements IDomainEvent {
    public readonly name = 'ssh-connection.deleted';
    public readonly occurredOn: Date;
    public readonly eventId: string;

    constructor(
        public readonly payload: SSHConnectionDeletedEventPayload
    ) {
        this.occurredOn = new Date();
        this.eventId = v4();
    }
}
