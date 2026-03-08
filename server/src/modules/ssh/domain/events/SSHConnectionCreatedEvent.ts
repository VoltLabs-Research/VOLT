import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface SSHConnectionCreatedEventPayload {
    sshConnectionId: string;
    teamId: string;
    name: string;
}

export default class SSHConnectionCreatedEvent extends BaseDomainEvent<SSHConnectionCreatedEventPayload> {
    constructor(payload: SSHConnectionCreatedEventPayload) {
        super('ssh-connection.created', payload);
    }
}
