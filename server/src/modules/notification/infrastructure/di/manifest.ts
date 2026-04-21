import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import NotificationRepository from '@modules/notification/infrastructure/persistence/mongo/repositories/NotificationRepository';
import NotificationSocketModule from '@modules/notification/socket/NotificationSocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const notificationDIManifest: ModuleManifest = {
    name: 'notification',
    singletons: [
        [NOTIFICATION_TOKENS.NotificationRepository, NotificationRepository],
        [NOTIFICATION_TOKENS.NotificationSocketModule, NotificationSocketModule]
    ],
    aliases: [[SOCKET_TOKENS.SocketModule, NOTIFICATION_TOKENS.NotificationSocketModule]]
};
