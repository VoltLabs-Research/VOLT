import { useMemo } from 'react';
import { useTeamRolesQuery } from '@/modules/team/hooks/team-role/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { TeamRole } from '@/modules/team/api/entities/team-role';

interface UseTeamRoleDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
}

const useTeamRoleData = ({ teamId, page = 1, limit = 100 }: UseTeamRoleDataOptions = {}) => {
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

    const rolesQuery = useTeamRolesQuery(queryParams!, {
        enabled: !!queryParams
    });

    return {
        roles: (rolesQuery.data?.data ?? []) as TeamRole[],
        isLoading: rolesQuery.isLoading || rolesQuery.isFetching,
        accessDenied,
        accessDeniedMessage
    };
};

export default useTeamRoleData;
