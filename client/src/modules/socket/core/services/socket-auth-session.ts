import socketService from './socket-service';
import teamSocketRoomService from '../../team/services/team-socket-room-service';
import { tokenStorage } from '@/shared/auth/token-storage';
import type { ISocketService } from './contracts/socket-service';

export const updateSocketAuthToken = (token: string | null): Promise<void> => {
    const service: ISocketService = socketService;
    service.updateAuth({ token: token ?? undefined });

    if (token) {
        return service.connect().catch(() => undefined);
    }

    return Promise.resolve();
};

export const refreshSocketSession = async (): Promise<void> => {
    const token = tokenStorage.getToken();
    const service: ISocketService = socketService;

    service.disconnect();
    service.updateAuth({ token: token ?? undefined });

    if (!token) {
        return;
    }

    await service.connect().catch(() => undefined);
};

export const clearSocketSession = (): void => {
    updateSocketAuthToken(null);
    teamSocketRoomService.unsubscribe();
    socketService.disconnect();
};
