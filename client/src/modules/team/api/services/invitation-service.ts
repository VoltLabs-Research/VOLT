import { createService, get, post, patch, del } from '@/app/core/http/utils/create-service';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamInvitation } from '@volt/contracts/modules/team/domain';

export interface AcceptInvitationInput {
    invitationId: string;
    teamId?: string;
}

export interface CancelInvitationInput {
    teamId: string;
    invitationId: string;
}

export interface GetInvitationDetailsInput {
    invitationId: string;
}

export interface GetPendingInvitationsInput {
    teamId: string;
}

export interface RejectInvitationInput {
    invitationId: string;
    teamId?: string;
}

export interface SendInvitationInput {
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
    getDetails: get<GetInvitationDetailsInput, TeamInvitation>(
        '/:invitationId', { client: 'invitations' }
    ),
    getPending: get<GetPendingInvitationsInput, TeamInvitation[]>(
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
    send: post<SendInvitationInput, void>(
        '/:teamId/invitations', {
            client: 'team',
            unwrap: 'void'
        }
    ),
    cancel: del<CancelInvitationInput>(
        '/:teamId/invitations/:invitationId', { client: 'team' }
    ),
    accept: patch<AcceptInvitationInput, void>(
        '/:invitationId/status', {
            client: 'invitations',
            unwrap: 'void'
        }
    ),
    reject: patch<RejectInvitationInput, void>(
        '/:invitationId/status', {
            client: 'invitations',
            unwrap: 'void'
        }
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
