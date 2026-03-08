import { useCallback, useMemo } from 'react';
import { fetchTeamMembers, TEAM_MEMBER_QUERY_KEYS } from '@/modules/team/hooks/team-member/queries';
import type { GetTeamMembersParams } from '@/modules/team/api/dtos/get-team-members';

const useTeamMembersListing = (teamId?: string | null) => {
    const queryKey = useMemo(() => TEAM_MEMBER_QUERY_KEYS.membersListing(teamId ?? ''), [teamId]);

    const fetchData = useCallback(async (params: GetTeamMembersParams) => {
        if (!teamId) {
            throw new Error('No team selected');
        }

        return fetchTeamMembers({
            teamId,
            ...params
        });
    }, [teamId]);

    return {
        queryKey,
        fetchData
    };
};

export default useTeamMembersListing;
