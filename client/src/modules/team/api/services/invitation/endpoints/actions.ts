import { post } from '@/app/core/http/utilities/create-service';
import type { AcceptInvitationInputDTO } from '../../../dtos/accept-invitation';
import type { RejectInvitationInputDTO } from '../../../dtos/reject-invitation';

const endpoints = {
    accept: post<AcceptInvitationInputDTO, void>(
        '/:invitationId/accept', { client: 'invitations', unwrap: 'void' }
    ),
    reject: post<RejectInvitationInputDTO, void>(
        '/:invitationId/reject', { client: 'invitations', unwrap: 'void' }
    )
};

export default endpoints;
