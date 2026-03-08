import { get, post, del } from '@/app/core/http/utilities/create-service';
import type { TeamInvitation } from '../../../entities/team-invitation';
import type { GetInvitationDetailsInputDTO } from '../../../dtos/get-invitation-details';
import type { GetPendingInvitationsInputDTO } from '../../../dtos/get-pending-invitations';
import type { SendInvitationInputDTO } from '../../../dtos/send-invitation';
import type { CancelInvitationInputDTO } from '../../../dtos/cancel-invitation';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const endpoints = {
    getDetails: get<GetInvitationDetailsInputDTO, TeamInvitation>(
        '/:invitationId', { client: 'invitations' }
    ),
    getPending: get<GetPendingInvitationsInputDTO, TeamInvitation[]>(
        '/:teamId/invitations/pending', {
            client: 'team',
            map: (result) => {
                const page = result as PaginatedResponse<TeamInvitation>;
                return page.data;
            }
        }
    ),
    send: post<SendInvitationInputDTO, void>(
        '/:teamId/invitations/invite', { client: 'team', unwrap: 'void' }
    ),
    cancel: del<CancelInvitationInputDTO>(
        '/:teamId/invitations/:invitationId', { client: 'team' }
    )
};

export default endpoints;
