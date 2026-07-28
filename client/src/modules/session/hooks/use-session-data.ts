import {
    activeSessionsQuery,
    loginActivityQuery,
    useRevokeAllOtherSessionsMutation,
    useRevokeSessionMutation
} from './queries';
import { closeModal, openModal } from '@voltstack/bravais';
import { confirmAction, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useMemo } from 'react';
import type { ActiveSession } from '@volt/contracts/modules/session/domain';

export const REVOKE_ALL_MODAL_ID = 'revoke-all-sessions-modal';

const LOGIN_ACTIVITY_LIMIT = 20;

const buildRevokeImpactDescription = (session: ActiveSession): string => {
    const device = `${session.browser} on ${session.os}`.trim();
    const location = session.ip ? ` (${session.ip})` : '';

    return `${device}${location} will be logged out immediately and must authenticate again.`;
};

const useSessionData = () => {
    const activeSessionsResult = activeSessionsQuery(undefined);
    const loginActivityResult = loginActivityQuery(LOGIN_ACTIVITY_LIMIT);
    const revokeSessionMutation = useRevokeSessionMutation();
    const revokeAllOtherSessionsMutation = useRevokeAllOtherSessionsMutation();

    const sessions = activeSessionsResult.data ?? [];
    const activities = loginActivityResult.data?.activities ?? [];
    const isRevoking = revokeSessionMutation.isPending || revokeAllOtherSessionsMutation.isPending;

    const otherSessionsCount = useMemo(
        () => sessions.filter((session) => !session.isCurrent).length,
        [sessions]
    );

    const openRevokeAllSessionsModal = () => {
        openModal(REVOKE_ALL_MODAL_ID);
    };

    const closeRevokeAllSessionsModal = () => {
        closeModal(REVOKE_ALL_MODAL_ID);
    };

    const revokeSession = async (session: ActiveSession) => {
        if (!session._id) return;

        const confirmed = await confirmAction({
            title: 'Revoke this session?',
            description: buildRevokeImpactDescription(session),
            confirmText: 'Revoke',
            tone: ConfirmActionTone.Danger
        });

        if (!confirmed) return;

        await showPromise(revokeSessionMutation.mutateAsync({ sessionId: session._id }), {
            loading: { title: 'Revoking session...' },
            success: { title: 'Session revoked' },
            error: { title: 'Failed to revoke session' }
        });
    };

    const revokeAllOtherSessions = async () => {
        await showPromise(revokeAllOtherSessionsMutation.mutateAsync(), {
            loading: { title: 'Revoking all other sessions...' },
            success: { title: 'All other sessions revoked' },
            error: { title: 'Failed to revoke sessions' }
        });

        closeRevokeAllSessionsModal();
    };

    return {
        sessions,
        activities,
        otherSessionsCount,
        isRevoking,
        loadingSessions: activeSessionsResult.isLoading,
        loadingActivity: loginActivityResult.isLoading,
        openRevokeAllSessionsModal,
        closeRevokeAllSessionsModal,
        revokeSession,
        revokeAllOtherSessions
    };
};

export default useSessionData;
