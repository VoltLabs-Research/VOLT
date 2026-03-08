import invitationService from '../../api/services/invitation';
import { buildKeys } from '@/shared/infrastructure/query';
import { invalidateTeamsQuery } from '../team/queries';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { TeamInvitation } from '../../api/entities/invitation/team-invitation';
import type { SendInvitationInputDTO } from '../../api/dtos/invitation/send-invitation';
import type { CancelInvitationInputDTO } from '../../api/dtos/invitation/cancel-invitation';
import type { AcceptInvitationInputDTO } from '../../api/dtos/invitation/accept-invitation';
import type { RejectInvitationInputDTO } from '../../api/dtos/invitation/reject-invitation';
import queryClient from '@/shared/infrastructure/query/query-client';

type QueryOptions<TQueryFnData, TData = TQueryFnData> = Partial<UseQueryOptions<TQueryFnData, Error, TData>>;

/** Team invitation query keys. */

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

/** Team invitation cache helpers. */

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

/** Team invitation queries. */

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

/** Team invitation mutations. */

export const useSendInvitationMutation = () => {
    return useMutation<void, Error, SendInvitationInputDTO>({
        mutationFn: invitationService.send,
        onSuccess: (_data, variables) => {
            invalidatePendingInvitationsQuery(variables.teamId);
        }
    });
};

export const useCancelInvitationMutation = () => {
    return useMutation<void, Error, CancelInvitationInputDTO>({
        mutationFn: invitationService.cancel,
        onSuccess: (_data, variables) => {
            invalidatePendingInvitationsQuery(variables.teamId);
        }
    });
};

export const useAcceptInvitationMutation = () => {
    return useMutation<void, Error, AcceptInvitationInputDTO>({
        mutationFn: invitationService.accept,
        onSuccess: (_data, variables) => {
            invalidateTeamsQuery();
            invalidateInvitationCollectionQuery(variables.teamId);
            invalidateInvitationDetailsQuery(variables.invitationId);
        }
    });
};

export const useRejectInvitationMutation = () => {
    return useMutation<void, Error, RejectInvitationInputDTO>({
        mutationFn: invitationService.reject,
        onSuccess: (_data, variables) => {
            invalidateInvitationCollectionQuery(variables.teamId);
            invalidateInvitationDetailsQuery(variables.invitationId);
        }
    });
};
