import { usePendingInvitationsQuery } from '@/modules/team/hooks/invitation/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect } from 'react';

export default function useTeamInvitationData() {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();
    const teamId = useSelectedTeamId();

    const pendingQuery = usePendingInvitationsQuery(teamId ?? '', {
        enabled: !!teamId
    });

    useEffect(() => {
        if (pendingQuery.error) {
            checkAccessDeniedError(pendingQuery.error);
        }
    }, [pendingQuery.error, checkAccessDeniedError]);

    let error: string | null = null;
    if (pendingQuery.error && !isAccessDeniedError(pendingQuery.error)) {
        error = reportError(pendingQuery.error, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load team invitations'
        }).title;
    }

    return {
        invitations: pendingQuery.data ?? [],
        isLoading: pendingQuery.isLoading || pendingQuery.isFetching,
        teamId,
        error,
        accessDenied,
        accessDeniedMessage
    };
}
