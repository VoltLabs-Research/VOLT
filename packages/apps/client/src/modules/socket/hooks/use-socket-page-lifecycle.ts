import { SOCKET_TEAM_EVENTS } from '@/modules/socket/events/team';
import useSocket from '@/modules/socket/hooks/use-socket';
import teamSocketRoomService from '@/modules/socket/services/team-room-service';
import { useEffect } from 'react';

export default function useSocketPageLifecycle(): void {
    const socketService = useSocket();

    useEffect(() => {
        const handlePageExit = () => {
            const currentTeamId = teamSocketRoomService.getCurrentTeamId();

            if (currentTeamId && socketService.isConnected()) {
                socketService.emitWithoutAck(SOCKET_TEAM_EVENTS.LEAVE, { teamId: currentTeamId });
            }

            socketService.disconnect();
        };

        window.addEventListener('pagehide', handlePageExit);
        window.addEventListener('beforeunload', handlePageExit);

        return () => {
            window.removeEventListener('pagehide', handlePageExit);
            window.removeEventListener('beforeunload', handlePageExit);
        };
    }, [socketService]);
}
