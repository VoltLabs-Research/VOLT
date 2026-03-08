import { BaseDomainEvent } from '@shared/application/events/BaseDomainEvent';

export interface SSHConnectionDeletedEventPayload {
    sshConnectionId: string;
    teamId: string;
}

export default class SSHConnectionDeletedEvent extends BaseDomainEvent<SSHConnectionDeletedEventPayload> {
    constructor(payload: SSHConnectionDeletedEventPayload) {
        super('ssh-connection.deleted', payload);
    }
}
