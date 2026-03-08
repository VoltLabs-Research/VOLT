import { fetchTeamRoles, TEAM_ROLE_QUERY_KEYS } from '@/modules/team/hooks/role/queries';
import type { GetTeamRolesParams } from '@/modules/team/api/dtos/role/get-team-roles';
import { useCallback, useMemo } from 'react';

export default function useTeamRolesListing(teamId?: string | null) {
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
}
