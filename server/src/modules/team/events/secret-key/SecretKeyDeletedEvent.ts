import { createTeamDomainEvent } from '@modules/team/events/team/createTeamDomainEvent';

export interface SecretKeyDeletedEventPayload {
    secretKeyId: string;
    teamId: string;
    userId: string;
    secretKeyName: string;
}

export default class SecretKeyDeletedEvent extends createTeamDomainEvent<SecretKeyDeletedEventPayload>('secret-key.deleted') {}
