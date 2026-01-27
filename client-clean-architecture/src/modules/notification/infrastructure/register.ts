import { registerNotificationDependencies } from '../application/registry';
import { notificationRepository } from './repositories/NotificationRepository';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';

export const registerNotificationInfrastructure = (): void => {
    registerNotificationDependencies({
        notificationRepository,
        socketService
    });
};
