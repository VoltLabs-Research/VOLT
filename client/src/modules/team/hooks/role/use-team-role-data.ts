import { useAllTeamRolesQuery } from '@/modules/team/hooks/role/queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect, useMemo } from 'react';

interface UseTeamRoleDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
};

export default function useTeamRoleData({ teamId, limit = 100 }: UseTeamRoleDataOptions = {}) {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
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

    useEffect(() => {
        if (rolesQuery.error) {
            checkAccessDeniedError(rolesQuery.error);
        }
    }, [rolesQuery.error, checkAccessDeniedError]);

    let error: string | null = null;
    if (rolesQuery.error && !isAccessDeniedError(rolesQuery.error)) {
        error = reportError(rolesQuery.error, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load team roles'
        }).title;
    }

    return {
        roles: rolesQuery.data ?? [],
        isLoading: rolesQuery.isLoading || rolesQuery.isFetching,
        error,
        accessDenied,
        accessDeniedMessage
    };
}
