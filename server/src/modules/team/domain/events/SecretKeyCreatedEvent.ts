import { createTeamDomainEvent } from './createTeamDomainEvent';

export interface SecretKeyCreatedEventPayload {
    secretKeyId: string;
    teamId: string;
    name: string;
}

export default class SecretKeyCreatedEvent extends createTeamDomainEvent<SecretKeyCreatedEventPayload>('secret-key.created') {}
