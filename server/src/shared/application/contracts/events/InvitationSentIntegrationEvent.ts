import type { IDomainEvent } from '@shared/application/events/IDomainEvent';

export interface InvitationSentIntegrationEventPayload {
    teamName: string;
    invitedUserId: string;
    invitationId: string;
}

export interface InvitationSentIntegrationEvent extends IDomainEvent {
    payload: InvitationSentIntegrationEventPayload;
}
