import { createTeamDomainEvent } from '@modules/team/events/team/createTeamDomainEvent';

export interface InvitationSentEventPayload {
    teamName: string;
    invitedUserId: string;
    invitationId: string;
}

export default class InvitationSentEvent extends createTeamDomainEvent<InvitationSentEventPayload>('invitation.sent') {}
