import { useTeamRolesQuery } from '@/modules/team/hooks/role/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useMemo } from 'react';

interface UseTeamRoleDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
};

export default function useTeamRoleData({ teamId, page = 1, limit = 100 }: UseTeamRoleDataOptions = {}) {
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
        roles: rolesQuery.data?.data ?? [],
        isLoading: rolesQuery.isLoading || rolesQuery.isFetching,
        accessDenied,
        accessDeniedMessage
    };
}
