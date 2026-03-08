import { useMemo } from 'react';
import { useTeamMembersQuery } from '@/modules/team/hooks/team-member/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { TeamMember } from '@/modules/team/api/entities/team-member';

interface UseTeamMemberDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
}

const useTeamMemberData = ({ teamId, page = 1, limit = 100 }: UseTeamMemberDataOptions = {}) => {
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

    const membersQuery = useTeamMembersQuery(queryParams!, {
        enabled: !!queryParams
    });

    return {
        members: (membersQuery.data?.data ?? []) as TeamMember[],
        isLoading: membersQuery.isLoading || membersQuery.isFetching,
        accessDenied,
        accessDeniedMessage
    };
};

export default useTeamMemberData;
