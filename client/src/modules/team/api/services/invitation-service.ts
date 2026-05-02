import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamInvitation } from '../entities/invitation/team-invitation';
import type { GetInvitationDetailsInputDTO } from '../dtos/invitation/get-invitation-details';
import type { GetPendingInvitationsInputDTO } from '../dtos/invitation/get-pending-invitations';
import type { SendInvitationInputDTO } from '../dtos/invitation/send-invitation';
import type { CancelInvitationInputDTO } from '../dtos/invitation/cancel-invitation';
import type { AcceptInvitationInputDTO } from '../dtos/invitation/accept-invitation';
import type { RejectInvitationInputDTO } from '../dtos/invitation/reject-invitation';

interface PendingInvitationsPage extends PaginatedResponse<TeamInvitation> {
    data: TeamInvitation[];
}

const isPendingInvitationsPage = (value: unknown): value is PendingInvitationsPage => {
    if (typeof value !== 'object' || value === null || !('data' in value)) {
        return false;
    }

    return Array.isArray(value.data);
};

const endpoints = {
    getDetails: get<GetInvitationDetailsInputDTO, TeamInvitation>(
        '/:invitationId', { client: 'invitations' }
    ),
    getPending: get<GetPendingInvitationsInputDTO, TeamInvitation[]>(
        '/:teamId/invitations?status=pending', {
            client: 'team',
            map: (result) => {
                if (!isPendingInvitationsPage(result)) {
                    throw new Error('Invalid pending invitations response');
                }

                return result.data;
            }
        }
    ),
    send: post<SendInvitationInputDTO, void>(
        '/:teamId/invitations', { client: 'team', unwrap: 'void' }
    ),
    cancel: del<CancelInvitationInputDTO>(
        '/:teamId/invitations/:invitationId', { client: 'team' }
    ),
    accept: patch<AcceptInvitationInputDTO, void>(
        '/:invitationId/status', { client: 'invitations', unwrap: 'void' }
    ),
    reject: patch<RejectInvitationInputDTO, void>(
        '/:invitationId/status', { client: 'invitations', unwrap: 'void' }
    )
};

export default createService({
    clients: {
        team: {
            basePath: '/teams',
            useRBAC: false
        },
        invitations: {
            basePath: '/teams/invitations',
            useRBAC: false
        }
    }
}, endpoints);
