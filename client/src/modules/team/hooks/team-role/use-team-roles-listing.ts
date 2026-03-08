import { useCallback, useMemo } from 'react';
import { fetchTeamRoles, TEAM_ROLE_QUERY_KEYS } from '@/modules/team/hooks/team-role/queries';
import type { GetTeamRolesParams } from '@/modules/team/api/dtos/get-team-roles';

const useTeamRolesListing = (teamId?: string | null) => {
    const queryKey = useMemo(() => TEAM_ROLE_QUERY_KEYS.rolesListing(teamId ?? ''), [teamId]);

    const fetchData = useCallback(async (params: GetTeamRolesParams) => {
        if (!teamId) {
            throw new Error('No team selected');
        }

        return fetchTeamRoles({
            teamId,
            ...params
        });
    }, [teamId]);

    return {
        queryKey,
        fetchData
    };
};

export default useTeamRolesListing;
