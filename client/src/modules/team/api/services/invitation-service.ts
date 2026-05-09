import { createService, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { TeamInvitation } from '../entities/invitation/team-invitation';

export interface AcceptInvitationInputDTO {
    invitationId: string;
    teamId?: string;
}

export interface CancelInvitationInputDTO {
    teamId: string;
    invitationId: string;
}

export interface GetInvitationDetailsInputDTO {
    invitationId: string;
}

export interface GetPendingInvitationsInputDTO {
    teamId: string;
}

export interface RejectInvitationInputDTO {
    invitationId: string;
    teamId?: string;
}

export interface SendInvitationInputDTO {
    teamId: string;
    email: string;
    roleId?: string;
}

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
