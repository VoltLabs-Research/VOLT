import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import NotificationSocketModule from '@modules/notification/socket/NotificationSocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerNotificationDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [NOTIFICATION_TOKENS.NotificationRepository, NotificationRepository],
            [NOTIFICATION_TOKENS.NotificationSocketModule, NotificationSocketModule]
        ],
        aliases: [[SOCKET_TOKENS.SocketModule, NOTIFICATION_TOKENS.NotificationSocketModule]]
    });
};
