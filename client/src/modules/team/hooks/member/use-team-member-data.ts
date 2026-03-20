import { useAllTeamMembersQuery } from '@/modules/team/hooks/member/queries';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect, useMemo } from 'react';

interface UseTeamMemberDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
};

export default function useTeamMemberData({ teamId, limit = 100 }: UseTeamMemberDataOptions = {}) {
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

    const membersQuery = useAllTeamMembersQuery(queryParams ?? { teamId: '', limit }, {
        enabled: !!queryParams
    });

    useEffect(() => {
        if (membersQuery.error) {
            checkAccessDeniedError(membersQuery.error);
        }
    }, [membersQuery.error, checkAccessDeniedError]);

    let error: string | null = null;
    if (membersQuery.error && !isAccessDeniedError(membersQuery.error)) {
        error = reportError(membersQuery.error, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load team members'
        }).title;
    }

    return {
        members: membersQuery.data ?? [],
        isLoading: membersQuery.isLoading || membersQuery.isFetching,
        error,
        accessDenied,
        accessDeniedMessage,
        refresh: membersQuery.refetch
    };
}
