import { usePendingInvitationsQuery } from '@/modules/team/hooks/invitation/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';

export default function useTeamInvitationData() {
    const { accessDenied, accessDeniedMessage } = useAccessDenied();
    const teamId = useSelectedTeamId();

    const pendingQuery = usePendingInvitationsQuery(teamId ?? '', {
        enabled: !!teamId
    });

    return {
        invitations: pendingQuery.data ?? [],
        isLoading: pendingQuery.isLoading || pendingQuery.isFetching,
        teamId,
        accessDenied,
        accessDeniedMessage
    };
}
