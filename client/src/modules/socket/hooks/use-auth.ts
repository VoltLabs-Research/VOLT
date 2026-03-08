import socketService from '../services/socket-service';
import teamSocketRoomService from '../services/team-socket-room-service';
import type { ISocketService } from '../api/entities/socket-service';

export const updateSocketAuthToken = (token: string | null): void => {
    const service: ISocketService = socketService;
    service.updateAuth({ token: token ?? undefined });

    if (token) {
        void service.connect().catch(() => undefined);
    }
};

export const clearSocketSession = (): void => {
    updateSocketAuthToken(null);
    teamSocketRoomService.unsubscribe();
    socketService.disconnect();
};
