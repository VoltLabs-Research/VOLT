import {
    activeSessionsQuery,
    loginActivityQuery,
    useRevokeAllOtherSessionsMutation,
    useRevokeSessionMutation
} from './queries';
import { tokenStorage } from '@/shared/auth/token-storage';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { useMemo, useState } from 'react';
import type { ActiveSession } from '../api/entities/session';

export const REVOKE_MODAL_ID = 'revoke-session-modal';
export const REVOKE_ALL_MODAL_ID = 'revoke-all-sessions-modal';

const LOGIN_ACTIVITY_LIMIT = 20;

const useSessionData = () => {
    const [revokeTarget, setRevokeTarget] = useState<ActiveSession | null>(null);

    const currentToken = tokenStorage.getToken();

    const activeSessionsResult = activeSessionsQuery(undefined);
    const loginActivityResult = loginActivityQuery(LOGIN_ACTIVITY_LIMIT);
    const revokeSessionMutation = useRevokeSessionMutation();
    const revokeAllOtherSessionsMutation = useRevokeAllOtherSessionsMutation();

    const sessions = activeSessionsResult.data ?? [];
    const activities = loginActivityResult.data?.activities ?? [];
    const isRevoking = revokeSessionMutation.isPending || revokeAllOtherSessionsMutation.isPending;

    const otherSessionsCount = useMemo(
        () => sessions.filter((session) => session.token !== currentToken).length,
        [currentToken, sessions]
    );

    const isCurrentSession = (session: ActiveSession) => session.token === currentToken;

    const openRevokeSessionModal = (session: ActiveSession) => {
        setRevokeTarget(session);
        openModal(REVOKE_MODAL_ID);
    };

    const closeRevokeSessionModal = () => {
        closeModal(REVOKE_MODAL_ID);
        setRevokeTarget(null);
    };

    const openRevokeAllSessionsModal = () => {
        openModal(REVOKE_ALL_MODAL_ID);
    };

    const closeRevokeAllSessionsModal = () => {
        closeModal(REVOKE_ALL_MODAL_ID);
    };

    const revokeSession = async () => {
        if (!revokeTarget?._id) return;

        await showPromise(revokeSessionMutation.mutateAsync({ sessionId: revokeTarget._id }), {
            loading: { title: 'Revoking session...' },
            success: { title: 'Session revoked' },
            error: { title: 'Failed to revoke session' }
        });

        closeRevokeSessionModal();
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
        revokeTarget,
        otherSessionsCount,
        isRevoking,
        isCurrentSession,
        loadingSessions: activeSessionsResult.isLoading,
        loadingActivity: loginActivityResult.isLoading,
        openRevokeSessionModal,
        closeRevokeSessionModal,
        openRevokeAllSessionsModal,
        closeRevokeAllSessionsModal,
        revokeSession,
        revokeAllOtherSessions
    };
};

export default useSessionData;
