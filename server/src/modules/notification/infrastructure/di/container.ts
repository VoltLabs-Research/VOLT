import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import NotificationSocketModule from '@modules/notification/socket/NotificationSocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { container } from 'tsyringe';

export const registerNotificationDependencies = () => {
    container.registerSingleton(NOTIFICATION_TOKENS.NotificationRepository, NotificationRepository);
    container.registerSingleton(NOTIFICATION_TOKENS.NotificationSocketModule, NotificationSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: NOTIFICATION_TOKENS.NotificationSocketModule });
};
