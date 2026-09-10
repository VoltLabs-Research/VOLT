import socketService from './socket-service';
import teamSocketRoomService from './team-room-service';
import { tokenStorage } from '@/shared/auth/token-storage';

export const updateSocketAuthToken = (token: string | null): void => {
    socketService.updateAuth({ token: token ?? undefined });

    if (token) {
        socketService.connect().catch(() => undefined);
    }
};

export const refreshSocketSession = async (): Promise<void> => {
    const token = tokenStorage.getToken();

    socketService.disconnect();
    socketService.updateAuth({ token: token ?? undefined });

    if (!token) {
        return;
    }

    await socketService.connect().catch(() => undefined);
};

export const clearSocketSession = (): void => {
    updateSocketAuthToken(null);
    teamSocketRoomService.unsubscribe();
    socketService.disconnect();
};
