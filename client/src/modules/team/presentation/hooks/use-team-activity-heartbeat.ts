import { useCallback, useEffect, useRef } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

const HEARTBEAT_INTERVAL_MS = 100;

const useTeamActivityHeartbeat = (): void => {
    const socketService = useSocket();
    const teamId = useTeamStore((state) => state.selectedTeam?._id ?? null);
    const isConnectedRef = useRef(socketService.isConnected());

    const sendHeartbeat = useCallback(() => {
        if (!teamId || !isConnectedRef.current) {
            return;
        }

        socketService.emit('team:heartbeat', { teamId }).catch(() => {
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

        return () => {
            unsubscribeConnection();
            window.clearInterval(interval);
        };
    }, [sendHeartbeat, socketService, teamId]);
};

export default useTeamActivityHeartbeat;
