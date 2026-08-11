import { createService, get, serviceRoutes } from '@/app/core/http/utils/create-service';
import { teamInvitationRoutes } from '@volt/contracts/modules/team/routes';

import type { PaginatedResponse } from '@voltstack/voltclient';
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

const routes = {
    team: serviceRoutes('/teams'),
    invitations: serviceRoutes('/teams/invitations')
};

const endpoints = {
    getDetails: routes.invitations.route<GetInvitationDetailsInput, TeamInvitation>(
        teamInvitationRoutes.getByIdPublic, { client: 'invitations' }
    ),
    getPending: get<GetPendingInvitationsInput, TeamInvitation[], PaginatedResponse<TeamInvitation>>(
        '/:teamId/invitations?status=pending', {
            client: 'team',
            map: (result) => result.data
        }
    ),
    send: routes.team.route<SendInvitationInput, void>(
        teamInvitationRoutes.send, {
            client: 'team',
            unwrap: 'void'
        }
    ),
    cancel: routes.team.route<CancelInvitationInput, void>(
        teamInvitationRoutes.remove, { client: 'team', unwrap: 'void' }
    ),
    accept: routes.invitations.route<InvitationStatusInput, void>(
        teamInvitationRoutes.updateStatusPublic, {
            client: 'invitations',
            unwrap: 'void'
        }
    ),
    reject: routes.invitations.route<InvitationStatusInput, void>(
        teamInvitationRoutes.updateStatusPublic, {
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
