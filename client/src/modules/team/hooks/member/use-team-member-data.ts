import { useTeamMembersQuery } from '@/modules/team/hooks/member/queries';
import { getApiErrorMessage, isAccessDeniedError } from '@/shared/errors/notify-api-error';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect, useMemo } from 'react';

interface UseTeamMemberDataOptions {
    teamId?: string | null;
    page?: number;
    limit?: number;
};

export default function useTeamMemberData({ teamId, page = 1, limit = 100 }: UseTeamMemberDataOptions = {}) {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
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

    useEffect(() => {
        if (membersQuery.error) {
            checkAccessDeniedError(membersQuery.error);
        }
    }, [membersQuery.error, checkAccessDeniedError]);

    let error: string | null = null;
    if (membersQuery.error && !isAccessDeniedError(membersQuery.error)) {
        error = getApiErrorMessage(membersQuery.error, 'Failed to load team members');
    }

    return {
        members: membersQuery.data?.data ?? [],
        isLoading: membersQuery.isLoading || membersQuery.isFetching,
        error,
        accessDenied,
        accessDeniedMessage,
        refresh: membersQuery.refetch
    };
}
