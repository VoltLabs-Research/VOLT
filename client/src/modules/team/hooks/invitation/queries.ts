import invitationService from '../../api/services/invitation';
import { createInvalidatingMutation, createQueryResource } from '@/shared/api/query-resources';
import { invalidateTeamsQuery } from '../team/queries';
import type { TeamInvitation } from '../../api/entities/invitation/team-invitation';
import type { SendInvitationInputDTO } from '../../api/dtos/invitation/send-invitation';
import type { CancelInvitationInputDTO } from '../../api/dtos/invitation/cancel-invitation';
import type { AcceptInvitationInputDTO } from '../../api/dtos/invitation/accept-invitation';
import type { RejectInvitationInputDTO } from '../../api/dtos/invitation/reject-invitation';
import queryClient from '@/shared/infrastructure/query/query-client';

const pendingInvitationsResource = createQueryResource<string, string, TeamInvitation[]>({
    baseKey: 'team-invitations',
    rootKey: 'invitations',
    itemKey: 'pendingInvitations',
    getKeyParam: (teamId) => teamId,
    query: (teamId) => invitationService.getPending({ teamId })
});

const invitationDetailsResource = createQueryResource<string, string, TeamInvitation>({
    baseKey: 'team-invitation-details',
    rootKey: 'invitationDetails',
    itemKey: 'invitationDetailsById',
    getKeyParam: (invitationId) => invitationId,
    query: (invitationId) => invitationService.getDetails({ invitationId })
});

export const TEAM_INVITATION_QUERY_KEYS = {
    invitations: pendingInvitationsResource.keys.root,
    pendingInvitations: pendingInvitationsResource.keys.item,
    invitationDetails: invitationDetailsResource.keys.root,
    invitationDetailsById: invitationDetailsResource.keys.item
};

const invalidatePendingInvitationsQuery = pendingInvitationsResource.invalidate;

const invalidateInvitationCollectionQuery = (teamId?: string) => {
    if (teamId) return invalidatePendingInvitationsQuery(teamId);
    return queryClient.invalidateQueries({ queryKey: TEAM_INVITATION_QUERY_KEYS.invitations() });
};

const invalidateInvitationDetailsQuery = invitationDetailsResource.invalidate;

export const usePendingInvitationsQuery = pendingInvitationsResource.query;

export const useInvitationDetailsQuery = invitationDetailsResource.query;

export const useSendInvitationMutation = createInvalidatingMutation<void, SendInvitationInputDTO>({
    mutationFn: invitationService.send,
    onSuccess: (_data, variables) => {
        void invalidatePendingInvitationsQuery(variables.teamId);
    }
});

export const useCancelInvitationMutation = createInvalidatingMutation<void, CancelInvitationInputDTO>({
    mutationFn: invitationService.cancel,
    onSuccess: (_data, variables) => {
        void invalidatePendingInvitationsQuery(variables.teamId);
    }
});

export const useAcceptInvitationMutation = createInvalidatingMutation<void, AcceptInvitationInputDTO>({
    mutationFn: invitationService.accept,
    onSuccess: (_data, variables) => {
        void invalidateTeamsQuery();
        void invalidateInvitationCollectionQuery(variables.teamId);
        void invalidateInvitationDetailsQuery(variables.invitationId);
    }
});

export const useRejectInvitationMutation = createInvalidatingMutation<void, RejectInvitationInputDTO>({
    mutationFn: invitationService.reject,
    onSuccess: (_data, variables) => {
        void invalidateInvitationCollectionQuery(variables.teamId);
        void invalidateInvitationDetailsQuery(variables.invitationId);
    }
});
