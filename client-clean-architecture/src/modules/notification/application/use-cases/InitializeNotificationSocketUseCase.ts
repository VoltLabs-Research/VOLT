import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import type { Notification } from '../../domain/entities/Notification';

export interface NotificationSocketCallbacks {
    onNotification: (notification: Notification) => void;
    onConnectError?: (error: unknown) => void;
}

export class InitializeNotificationSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    execute(callbacks: NotificationSocketCallbacks): () => void {
        const off = this.socketService.on('notification', callbacks.onNotification);

        if (!this.socketService.isConnected()) {
            this.socketService.connect().catch((error) => {
                callbacks.onConnectError?.(error);
            });
        }

        return () => off();
    }
}
