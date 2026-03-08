import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface SecretKeyDeletedEventPayload {
    secretKeyId: string;
    teamId: string;
}

export default class SecretKeyDeletedEvent extends createTeamDomainEvent<SecretKeyDeletedEventPayload>('secret-key.deleted') {}
