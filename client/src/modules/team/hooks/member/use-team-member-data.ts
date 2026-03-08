import { useTeamMembersQuery } from '@/modules/team/hooks/member/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useMemo } from 'react';

interface UseTeamMemberDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
};

export default function useTeamMemberData({ teamId, page = 1, limit = 100 }: UseTeamMemberDataOptions = {}) {
    const { accessDenied, accessDeniedMessage } = useAccessDenied();
    const queryParams = useMemo(() => {
        if (!teamId) {
            return null;
        }

        return {
            teamId,
            page,
            limit
        };
    }, [teamId, page, limit]);

    const membersQuery = useTeamMembersQuery(queryParams ?? { teamId: '', page, limit }, {
        enabled: !!queryParams
    });

    return {
        members: membersQuery.data?.data ?? [],
        isLoading: membersQuery.isLoading || membersQuery.isFetching,
        accessDenied,
        accessDeniedMessage
    };
}
