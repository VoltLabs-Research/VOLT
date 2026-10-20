import type {
    InvitationSentEventPayload,
    SecretKeyCreatedEventPayload,
    SecretKeyDeletedEventPayload,
    TeamCreatedEventPayload,
    TeamDeletedEventPayload,
    TeamMemberDeletedEventPayload,
    TeamRoleCreatedEventPayload,
    TeamRoleDeletedEventPayload,
    TeamRoleUpdatedEventPayload
} from '@modules/team/contracts/events';

declare global {
    interface EventMap {
        'team.created': TeamCreatedEventPayload;
        'team.deleted': TeamDeletedEventPayload;
        'team-member.deleted': TeamMemberDeletedEventPayload;
        'team-role.created': TeamRoleCreatedEventPayload;
        'team-role.deleted': TeamRoleDeletedEventPayload;
        'team-role.updated': TeamRoleUpdatedEventPayload;
        'secret-key.created': SecretKeyCreatedEventPayload;
        'secret-key.deleted': SecretKeyDeletedEventPayload;
        'invitation.sent': InvitationSentEventPayload;
    }
}
