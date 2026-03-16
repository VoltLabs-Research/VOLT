import { SOCKET_TEAM_EVENTS } from '@/modules/socket/team/constants/team-socket-events';
import useSocket from '@/modules/socket/core/hooks/use-socket';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useCallback, useEffect, useRef } from 'react';

const HEARTBEAT_INTERVAL_MS = 10_000;

export default function useTeamActivityHeartbeat(): void {
    const socketService = useSocket();
    const teamId = useSelectedTeamId();
    const isConnectedRef = useRef(socketService.isConnected());

    const sendHeartbeat = useCallback(() => {
        if (!teamId || !isConnectedRef.current || document.hidden) {
            return;
        }

        socketService.emit(SOCKET_TEAM_EVENTS.HEARTBEAT, { teamId }).catch(() => {
        });
    }, [socketService, teamId]);

    useEffect(() => {
        isConnectedRef.current = socketService.isConnected();

        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            isConnectedRef.current = connected;

            if (connected) {
                sendHeartbeat();
            }
        });

        if (teamId && isConnectedRef.current) {
            sendHeartbeat();
        }

        const interval = window.setInterval(() => {
            sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                sendHeartbeat();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            unsubscribeConnection();
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [sendHeartbeat, socketService, teamId]);
}
