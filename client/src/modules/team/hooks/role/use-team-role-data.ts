import { useAllTeamRolesQuery } from '@/modules/team/hooks/role/queries';
import useTeamQueryState from '@/modules/team/hooks/use-team-query-state';
import { useMemo } from 'react';

interface UseTeamRoleDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
}

export default function useTeamRoleData({ teamId, limit = 100 }: UseTeamRoleDataOptions = {}) {
    const queryParams = useMemo(() => {
        if (!teamId) {
            return null;
        }

        return {
            teamId,
            limit
        };
    }, [teamId, limit]);

    const rolesQuery = useAllTeamRolesQuery(queryParams ?? { teamId: '', limit }, {
        enabled: !!queryParams
    });
    const queryState = useTeamQueryState(rolesQuery, 'Failed to load team roles');

    return {
        roles: queryState.data ?? [],
        isLoading: queryState.isLoading,
        error: queryState.error,
        accessDenied: queryState.accessDenied,
        accessDeniedMessage: queryState.accessDeniedMessage
    };
}
