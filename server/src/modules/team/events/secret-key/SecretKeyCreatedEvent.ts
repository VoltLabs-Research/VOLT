import { createTeamDomainEvent } from '@modules/team/events/team/createTeamDomainEvent';

export interface SecretKeyCreatedEventPayload {
    secretKeyId: string;
    teamId: string;
    name: string;
    userId: string;
}

export default class SecretKeyCreatedEvent extends createTeamDomainEvent<SecretKeyCreatedEventPayload>('secret-key.created') {}
