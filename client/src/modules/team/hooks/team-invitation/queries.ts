import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import queryClient from '@/shared/infrastructure/query/query-client';
import { buildKeys } from '@/shared/infrastructure/query';
import type { TeamInvitation } from '../../api/entities/team-invitation';
import type { SendInvitationInputDTO } from '../../api/dtos/send-invitation';
import type { CancelInvitationInputDTO } from '../../api/dtos/cancel-invitation';
import type { AcceptInvitationInputDTO } from '../../api/dtos/accept-invitation';
import type { RejectInvitationInputDTO } from '../../api/dtos/reject-invitation';
import { invalidateTeamsQuery } from '../team/queries';
import invitationService from '../../api/services/invitation';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const invitationKeys = buildKeys<{
    invitations: void;
    pendingInvitations: string;
}>('team-invitations');

const invitationDetailKeys = buildKeys<{
    invitationDetails: void;
    invitationDetailsById: string;
}>('team-invitation-details');

export const TEAM_INVITATION_QUERY_KEYS = {
    invitations: invitationKeys.invitations,
    pendingInvitations: invitationKeys.pendingInvitations,
    invitationDetails: invitationDetailKeys.invitationDetails,
    invitationDetailsById: invitationDetailKeys.invitationDetailsById
};

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

const invalidatePendingInvitationsQuery = (teamId: string) => {
    return queryClient.invalidateQueries({ queryKey: TEAM_INVITATION_QUERY_KEYS.pendingInvitations(teamId) });
};

const invalidateInvitationCollectionQuery = (teamId?: string) => {
    if (teamId) return invalidatePendingInvitationsQuery(teamId);
    return queryClient.invalidateQueries({ queryKey: TEAM_INVITATION_QUERY_KEYS.invitations() });
};

const invalidateInvitationDetailsQuery = (invitationId: string) => {
    return queryClient.invalidateQueries({ queryKey: TEAM_INVITATION_QUERY_KEYS.invitationDetailsById(invitationId) });
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export const usePendingInvitationsQuery = (teamId: string, options?: QueryOptions<TeamInvitation[]>) => {
    return useQuery({
        queryKey: TEAM_INVITATION_QUERY_KEYS.pendingInvitations(teamId),
        queryFn: () => invitationService.getPending({ teamId }),
        ...options
    });
};

export const useInvitationDetailsQuery = (invitationId: string, options?: QueryOptions<TeamInvitation>) => {
    return useQuery({
        queryKey: TEAM_INVITATION_QUERY_KEYS.invitationDetailsById(invitationId),
        queryFn: () => invitationService.getDetails({ invitationId }),
        ...options
    });
};

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export const useSendInvitationMutation = () => {
    return useMutation<void, Error, SendInvitationInputDTO>({
        mutationFn: invitationService.send,
        onSuccess: (_data, variables) => {
            void invalidatePendingInvitationsQuery(variables.teamId);
        }
    });
};

export const useCancelInvitationMutation = () => {
    return useMutation<void, Error, CancelInvitationInputDTO>({
        mutationFn: invitationService.cancel,
        onSuccess: (_data, variables) => {
            void invalidatePendingInvitationsQuery(variables.teamId);
        }
    });
};

export const useAcceptInvitationMutation = () => {
    return useMutation<void, Error, AcceptInvitationInputDTO>({
        mutationFn: invitationService.accept,
        onSuccess: (_data, variables) => {
            void invalidateTeamsQuery();
            void invalidateInvitationCollectionQuery(variables.teamId);
            void invalidateInvitationDetailsQuery(variables.invitationId);
        }
    });
};

export const useRejectInvitationMutation = () => {
    return useMutation<void, Error, RejectInvitationInputDTO>({
        mutationFn: invitationService.reject,
        onSuccess: (_data, variables) => {
            void invalidateInvitationCollectionQuery(variables.teamId);
            void invalidateInvitationDetailsQuery(variables.invitationId);
        }
    });
};
