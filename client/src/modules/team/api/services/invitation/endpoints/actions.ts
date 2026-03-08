import { patch } from '@/app/core/http/utilities/create-service';
import type { AcceptInvitationInputDTO } from '../../../dtos/invitation/accept-invitation';
import type { RejectInvitationInputDTO } from '../../../dtos/invitation/reject-invitation';

export default {
    accept: patch<AcceptInvitationInputDTO, void>(
        '/:invitationId/status', { client: 'invitations', unwrap: 'void' }
    ),
    reject: patch<RejectInvitationInputDTO, void>(
        '/:invitationId/status', { client: 'invitations', unwrap: 'void' }
    )
};
