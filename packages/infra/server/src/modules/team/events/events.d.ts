import type {
    InvitationSentEventPayload,
    SecretKeyCreatedEventPayload,
    SecretKeyDeletedEventPayload,
    TeamCreatedEventPayload,
    TeamDeletedEventPayload,
    TeamMemberDeletedEventPayload
} from '@modules/team/contracts/events';

declare global {
    interface EventMap {
        'team.created': TeamCreatedEventPayload;
        'team.deleted': TeamDeletedEventPayload;
        'team-member.deleted': TeamMemberDeletedEventPayload;
        'secret-key.created': SecretKeyCreatedEventPayload;
        'secret-key.deleted': SecretKeyDeletedEventPayload;
        'invitation.sent': InvitationSentEventPayload;
    }
}
