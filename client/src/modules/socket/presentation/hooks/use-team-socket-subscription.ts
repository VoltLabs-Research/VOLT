import { useEffect, useRef } from 'react';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';

const useTeamSocketSubscription = (): void => {
    const socketService = useSocket();
    const teamId = useTeamStore((state) => state.selectedTeam?._id ?? null);
    const previousTeamIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!teamId) return;
        let cancelled = false;
        const previousTeamId = previousTeamIdRef.current;

        const ensureSubscription = async () => {
            try {
                if (!socketService.isConnected()) {
                    await socketService.connect();
                }
                if (cancelled) return;
                socketService.subscribeToTeam(teamId, previousTeamId ?? undefined);
                previousTeamIdRef.current = teamId;
            } catch (error) {
                console.error('[useTeamSocketSubscription] failed to connect socket', error);
            }
        };

        ensureSubscription();
        return () => {
            cancelled = true;
        };
    }, [socketService, teamId]);
};

export default useTeamSocketSubscription;
