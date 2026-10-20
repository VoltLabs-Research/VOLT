import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocket from '@/modules/socket/hooks/use-socket';
import useSocketConnectionEffect from '@/modules/socket/hooks/use-socket-connection-effect';
import { emitOrSwallow } from '@/modules/socket/services/socket-emit-helpers';
import teamSocketRoomService from '@/modules/socket/services/team-room-service';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback, useEffect } from 'react';

const HEARTBEAT_INTERVAL_MS = 10_000;

export default function useTeamActivityHeartbeat(): void {
    const socketService = useSocket();
    const teamId = useSelectedTeamId();

    const sendHeartbeat = useCallback(() => {
        if (!teamId || !socketService.isConnected() || document.hidden) {
            return;
        }

        teamSocketRoomService.waitUntilSubscribed(teamId)
            .then(() => {
                if (!socketService.isConnected() || document.hidden) {
                    return;
                }

                emitOrSwallow(SOCKET_TEAM_EVENTS.HEARTBEAT, { teamId });
            })
            .catch(() => undefined);
    }, [socketService, teamId]);

    useSocketConnectionEffect((connected) => {
        if (connected) sendHeartbeat();
    });

    useEffect(() => {
        sendHeartbeat();

        const interval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (!document.hidden) sendHeartbeat();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sendHeartbeat]);
}
