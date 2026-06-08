import { usePendingInvitationsQuery } from '@/modules/team/hooks/invitation/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useQueryState from '@/shared/presentation/hooks/use-query-state';

export default function useTeamInvitationData() {
    const teamId = useSelectedTeamId();

    const pendingQuery = usePendingInvitationsQuery(teamId ?? '', {
        enabled: !!teamId
    });

    const { data, isLoading, error, accessDenied, accessDeniedMessage } = useQueryState(
        pendingQuery,
        'Failed to load team invitations'
    );

    return {
        invitations: data ?? [],
        isLoading,
        teamId,
        error,
        accessDenied,
        accessDeniedMessage
    };
}
