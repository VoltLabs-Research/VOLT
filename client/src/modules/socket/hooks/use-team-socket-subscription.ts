import { useEffect, useRef } from 'react';
import { useTeamPresenceStore } from '@/modules/team/stores/use-team-presence-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamSocketRoom from './use-team-socket-room';

const useTeamSocketSubscription = (): void => {
    const teamSocketRoom = useTeamSocketRoom();
    const teamId = useSelectedTeamId();
    const resetTeamPresence = useTeamPresenceStore((state) => state.reset);
    const previousTeamIdRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const previousTeamId = previousTeamIdRef.current;

        if (!teamId) {
            if (previousTeamId) {
                teamSocketRoom.unsubscribe(previousTeamId);
            }
            resetTeamPresence();
            previousTeamIdRef.current = null;
            return;
        }

        if (previousTeamId !== teamId) {
            resetTeamPresence();

            if (previousTeamId) {
                teamSocketRoom.unsubscribe(previousTeamId);
            }
        }

        const ensureSubscription = async () => {
            try {
                await teamSocketRoom.subscribe(teamId, previousTeamId ?? undefined);
                if (cancelled) return;
                previousTeamIdRef.current = teamId;
            } catch {
            }
        };

        ensureSubscription();
        return () => {
            cancelled = true;
        };
    }, [resetTeamPresence, teamId, teamSocketRoom]);

    useEffect(() => {
        return () => {
            const subscribedTeamId = previousTeamIdRef.current;

            if (subscribedTeamId) {
                teamSocketRoom.unsubscribe(subscribedTeamId);
                previousTeamIdRef.current = null;
            }

            resetTeamPresence();
        };
    }, [resetTeamPresence, teamSocketRoom]);
};

export default useTeamSocketSubscription;
