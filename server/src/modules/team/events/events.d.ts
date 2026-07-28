import type { SecretKeyCreatedEventPayload } from '@modules/team/events/secret-key/SecretKeyCreatedEvent';
import type { SecretKeyDeletedEventPayload } from '@modules/team/events/secret-key/SecretKeyDeletedEvent';
import type { InvitationSentEventPayload } from '@modules/team/events/team-invitation/InvitationSentEvent';
import type { TeamMemberDeletedEventPayload } from '@modules/team/events/team-member/TeamMemberDeletedEvent';
import type { TeamRoleCreatedEventPayload } from '@modules/team/events/team-role/TeamRoleCreatedEvent';
import type { TeamRoleDeletedEventPayload } from '@modules/team/events/team-role/TeamRoleDeletedEvent';
import type { TeamRoleUpdatedEventPayload } from '@modules/team/events/team-role/TeamRoleUpdatedEvent';
import type { TeamCreatedEventPayload } from '@modules/team/events/team/TeamCreatedEvent';
import type { TeamDeletedEventPayload } from '@modules/team/events/team/TeamDeletedEvent';

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
