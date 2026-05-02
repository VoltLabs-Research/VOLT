import invitationService from '../../api/services/invitation-service';
import { invalidateTeamsQuery } from '../team/queries';
import { buildKeys, createMutation, createQuery, queryClient } from '@/shared/infrastructure/query';
import type { AcceptInvitationInputDTO } from '../../api/dtos/invitation/accept-invitation';
import type { CancelInvitationInputDTO } from '../../api/dtos/invitation/cancel-invitation';
import type { RejectInvitationInputDTO } from '../../api/dtos/invitation/reject-invitation';
import type { SendInvitationInputDTO } from '../../api/dtos/invitation/send-invitation';
import type { TeamInvitation } from '../../api/entities/invitation/team-invitation';

interface TeamInvitationQueryKeyMap {
    invitations: void;
    pendingInvitations: string;
}

interface TeamInvitationDetailsQueryKeyMap {
    invitationDetails: void;
    invitationDetailsById: string;
}

const invitationKeys = buildKeys<TeamInvitationQueryKeyMap>('team-invitations');

const invitationDetailKeys = buildKeys<TeamInvitationDetailsQueryKeyMap>('team-invitation-details');

export const TEAM_INVITATION_QUERY_KEYS = {
    invitations: invitationKeys.prefix,
    pendingInvitations: invitationKeys.pendingInvitations,
    invitationDetails: invitationDetailKeys.prefix,
    invitationDetailsById: invitationDetailKeys.invitationDetailsById
};

const invalidatePendingInvitationsQuery = (teamId: string) => {
    return queryClient.invalidateQueries({
        queryKey: TEAM_INVITATION_QUERY_KEYS.pendingInvitations(teamId)
    });
};

const invalidateInvitationCollectionQuery = (teamId?: string) => {
    if (teamId) return invalidatePendingInvitationsQuery(teamId);
    return queryClient.invalidateQueries({ queryKey: TEAM_INVITATION_QUERY_KEYS.invitations() });
};

const invalidateInvitationDetailsQuery = (invitationId: string) => {
    return queryClient.invalidateQueries({
        queryKey: TEAM_INVITATION_QUERY_KEYS.invitationDetailsById(invitationId)
    });
};

export const usePendingInvitationsQuery = createQuery<string, TeamInvitation[]>(
    TEAM_INVITATION_QUERY_KEYS.pendingInvitations,
    (teamId: string) => {
        return invitationService.getPending({ teamId });
    }
);

export const useInvitationDetailsQuery = createQuery<string, TeamInvitation>(
    TEAM_INVITATION_QUERY_KEYS.invitationDetailsById,
    (invitationId: string) => {
        return invitationService.getDetails({ invitationId });
    }
);

export const useSendInvitationMutation = createMutation<void, SendInvitationInputDTO>(
    invitationService.send,
    async (_data, variables) => {
        await invalidatePendingInvitationsQuery(variables.teamId);
    }
);

export const useCancelInvitationMutation = createMutation<void, CancelInvitationInputDTO>(
    invitationService.cancel,
    async (_data, variables) => {
        await invalidatePendingInvitationsQuery(variables.teamId);
    }
);

export const useAcceptInvitationMutation = createMutation<void, AcceptInvitationInputDTO>(
    invitationService.accept,
    async (_data, variables) => {
        await invalidateTeamsQuery();
        await invalidateInvitationCollectionQuery(variables.teamId);
        await invalidateInvitationDetailsQuery(variables.invitationId);
    }
);

export const useRejectInvitationMutation = createMutation<void, RejectInvitationInputDTO>(
    invitationService.reject,
    async (_data, variables) => {
        await invalidateInvitationCollectionQuery(variables.teamId);
        await invalidateInvitationDetailsQuery(variables.invitationId);
    }
);
