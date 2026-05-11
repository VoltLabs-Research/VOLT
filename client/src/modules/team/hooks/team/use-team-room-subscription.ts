import teamSocketRoomService from '@/modules/socket/services/team-room-service';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { useEffect, useRef } from 'react';

export default function useTeamRoomSubscription(): void {
    const teamId = useSelectedTeamId();
    const previousTeamIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!teamId) {
            teamSocketRoomService.unsubscribe(previousTeamIdRef.current ?? undefined);
            previousTeamIdRef.current = null;
            useTeamPresenceStore.getState().reset();
            return;
        }

        const previousTeamId = previousTeamIdRef.current;
        if (previousTeamId && previousTeamId !== teamId) {
            useTeamPresenceStore.getState().reset();
        }

        previousTeamIdRef.current = teamId;
        teamSocketRoomService.subscribe(teamId, previousTeamId ?? undefined).catch(() => undefined);

        return () => {
            teamSocketRoomService.unsubscribe(teamId);
        };
    }, [teamId]);
}
