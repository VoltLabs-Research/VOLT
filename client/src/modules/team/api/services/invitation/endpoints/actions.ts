import { patch } from '@/app/core/http/utilities/create-service';
import type { AcceptInvitationInputDTO } from '../../../dtos/accept-invitation';
import type { RejectInvitationInputDTO } from '../../../dtos/reject-invitation';

const endpoints = {
    accept: patch<AcceptInvitationInputDTO, void>(
        '/:invitationId/status', { client: 'invitations', unwrap: 'void' }
    ),
    reject: patch<RejectInvitationInputDTO, void>(
        '/:invitationId/status', { client: 'invitations', unwrap: 'void' }
    )
};

export default endpoints;
