import socketService from './socket-service';
import teamSocketRoomService from '../../team/services/team-socket-room-service';
import type { ISocketService } from './contracts/socket-service';

export const updateSocketAuthToken = (token: string | null): void => {
    const service: ISocketService = socketService;
    service.updateAuth({ token: token ?? undefined });

    if (token) {
        service.connect().catch(() => undefined);
    }
};

export const clearSocketSession = (): void => {
    updateSocketAuthToken(null);
    teamSocketRoomService.unsubscribe();
    socketService.disconnect();
};
