import { usePendingInvitationsQuery } from '@/modules/team/hooks/team-invitation/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { TeamInvitation } from '@/modules/team/api/entities/team-invitation';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

const useTeamInvitationData = () => {
    const { accessDenied, accessDeniedMessage } = useAccessDenied();
    const teamId = useSelectedTeamId();

    const pendingQuery = usePendingInvitationsQuery(teamId ?? '', {
        enabled: !!teamId
    });

    return {
        invitations: (pendingQuery.data ?? []) as TeamInvitation[],
        isLoading: pendingQuery.isLoading || pendingQuery.isFetching,
        teamId,
        accessDenied,
        accessDeniedMessage
    };
};

export default useTeamInvitationData;
