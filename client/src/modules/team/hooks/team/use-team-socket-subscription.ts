import teamSocketRoomService from '@/modules/socket/team/services/team-socket-room-service';
import { useSelectedTeamId } from './use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { useEffect, useRef } from 'react';

export default function useTeamSocketSubscription(): void {
    const teamId = useSelectedTeamId();
    const resetTeamPresence = useTeamPresenceStore((state) => state.reset);
    const previousTeamIdRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const previousTeamId = previousTeamIdRef.current;

        if (!teamId) {
            if (previousTeamId) {
                teamSocketRoomService.unsubscribe(previousTeamId);
            }
            resetTeamPresence();
            previousTeamIdRef.current = null;
            return;
        }

        if (previousTeamId !== teamId) {
            resetTeamPresence();

            if (previousTeamId) {
                teamSocketRoomService.unsubscribe(previousTeamId);
            }
        }

        const ensureSubscription = async () => {
            try {
                await teamSocketRoomService.subscribe(teamId, previousTeamId ?? undefined);
                if (cancelled) {
                    return;
                }
                previousTeamIdRef.current = teamId;
            } catch {
            }
        };

        ensureSubscription();

        return () => {
            cancelled = true;
        };
    }, [resetTeamPresence, teamId]);

    useEffect(() => {
        return () => {
            const subscribedTeamId = previousTeamIdRef.current;

            if (subscribedTeamId) {
                teamSocketRoomService.unsubscribe(subscribedTeamId);
                previousTeamIdRef.current = null;
            }

            resetTeamPresence();
        };
    }, [resetTeamPresence]);
}
