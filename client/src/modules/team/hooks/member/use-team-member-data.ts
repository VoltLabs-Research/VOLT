import { useAllTeamMembersQuery } from '@/modules/team/hooks/member/queries';
import useTeamQueryState from '@/modules/team/hooks/use-team-query-state';
import { useMemo } from 'react';

interface UseTeamMemberDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
}

export default function useTeamMemberData({ teamId, limit = 100 }: UseTeamMemberDataOptions = {}) {
    const queryParams = useMemo(() => {
        if (!teamId) {
            return null;
        }

        return {
            teamId,
            limit
        };
    }, [teamId, limit]);

    const membersQuery = useAllTeamMembersQuery(queryParams ?? { teamId: '', limit }, {
        enabled: !!queryParams
    });
    const queryState = useTeamQueryState(membersQuery, 'Failed to load team members');

    return {
        members: queryState.data ?? [],
        isLoading: queryState.isLoading,
        error: queryState.error,
        accessDenied: queryState.accessDenied,
        accessDeniedMessage: queryState.accessDeniedMessage,
        refresh: queryState.refresh
    };
}
