import { createService, get, post, patch, del } from '@/app/core/http/utils/create-service';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { TeamInvitation } from '@volt/contracts/modules/team/domain';

export interface InvitationStatusInput {
    invitationId: string;
    teamId?: string;
}

export interface CancelInvitationInput {
    teamId: string;
    invitationId: string;
}

interface GetInvitationDetailsInput {
    invitationId: string;
}

interface GetPendingInvitationsInput {
    teamId: string;
}

export interface SendInvitationInput {
    teamId: string;
    email: string;
    roleId?: string;
}

const endpoints = {
    getDetails: get<GetInvitationDetailsInput, TeamInvitation>(
        '/:invitationId', { client: 'invitations' }
    ),
    getPending: get<GetPendingInvitationsInput, TeamInvitation[], PaginatedResponse<TeamInvitation>>(
        '/:teamId/invitations?status=pending', {
            client: 'team',
            map: (result) => result.data
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
    accept: patch<InvitationStatusInput, void>(
        '/:invitationId/status', {
            client: 'invitations',
            unwrap: 'void'
        }
    ),
    reject: patch<InvitationStatusInput, void>(
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
