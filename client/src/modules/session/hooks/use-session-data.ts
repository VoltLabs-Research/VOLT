import {
    activeSessionsQuery,
    loginActivityQuery,
    useRevokeAllOtherSessionsMutation,
    useRevokeSessionMutation
} from './queries';
import { closeModal, openModal } from '@/shared/ui/modal/use-modal-store';
import { confirmAction, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import { showPromise } from '@/shared/ui/hooks/toast';
import type { ActiveSession } from '@volt/contracts/modules/session/domain';

export const REVOKE_ALL_MODAL_ID = 'revoke-all-sessions-modal';

const useSessionData = () => {
    const activeSessionsResult = activeSessionsQuery(undefined);
    const loginActivityResult = loginActivityQuery(undefined);
    const revokeSessionMutation = useRevokeSessionMutation();
    const revokeAllOtherSessionsMutation = useRevokeAllOtherSessionsMutation();

    const sessions = activeSessionsResult.data ?? [];

    const closeRevokeAllSessionsModal = () => {
        closeModal(REVOKE_ALL_MODAL_ID);
    };

    const revokeSession = async (session: ActiveSession) => {
        const confirmed = await confirmAction({
            title: 'Revoke this session?',
            description: `${session.browser} on ${session.os} (${session.ip}) will be logged out immediately and must authenticate again.`,
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
        activities: loginActivityResult.data?.activities ?? [],
        otherSessionsCount: sessions.filter((session) => !session.isCurrent).length,
        isRevoking: revokeSessionMutation.isPending || revokeAllOtherSessionsMutation.isPending,
        loadingSessions: activeSessionsResult.isLoading,
        loadingActivity: loginActivityResult.isLoading,
        openRevokeAllSessionsModal: () => openModal(REVOKE_ALL_MODAL_ID),
        closeRevokeAllSessionsModal,
        revokeSession,
        revokeAllOtherSessions
    };
};

export default useSessionData;
