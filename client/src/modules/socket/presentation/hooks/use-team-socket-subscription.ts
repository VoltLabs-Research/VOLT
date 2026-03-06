import { useEffect, useRef } from 'react';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useTeamPresenceStore } from '@/modules/team/presentation/stores/use-team-presence-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

const useTeamSocketSubscription = (): void => {
    const socketService = useSocket();
    const teamId = useTeamStore((state) => state.selectedTeam?._id ?? null);
    const resetTeamPresence = useTeamPresenceStore((state) => state.reset);
    const previousTeamIdRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const previousTeamId = previousTeamIdRef.current;

        if (!teamId) {
            if (previousTeamId) {
                socketService.unsubscribeFromTeam(previousTeamId);
            }
            resetTeamPresence();
            previousTeamIdRef.current = null;
            return;
        }

        if (previousTeamId !== teamId) {
            resetTeamPresence();

            if (previousTeamId) {
                socketService.unsubscribeFromTeam(previousTeamId);
            }
        }

        const ensureSubscription = async () => {
            try {
                if (!socketService.isConnected()) {
                    await socketService.connect();
                }
                if (cancelled) return;
                socketService.subscribeToTeam(teamId, previousTeamId ?? undefined);
                previousTeamIdRef.current = teamId;
            } catch {
            }
        };

        ensureSubscription();
        return () => {
            cancelled = true;
        };
    }, [resetTeamPresence, socketService, teamId]);

    useEffect(() => {
        return () => {
            const subscribedTeamId = previousTeamIdRef.current;

            if (subscribedTeamId) {
                socketService.unsubscribeFromTeam(subscribedTeamId);
                previousTeamIdRef.current = null;
            }

            resetTeamPresence();
        };
    }, [resetTeamPresence, socketService]);
};

export default useTeamSocketSubscription;
