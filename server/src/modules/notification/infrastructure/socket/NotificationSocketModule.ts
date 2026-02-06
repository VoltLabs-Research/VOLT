import { inject, singleton } from 'tsyringe';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import NotificationCreatedEvent from '@modules/notification/domain/events/NotificationCreatedEvent';
import logger from '@shared/infrastructure/logger';

/**
 * Socket module for real-time notifications.
 * Users join their personal notification room and receive notifications in real-time.
 */
@singleton()
export default class NotificationSocketModule extends BaseSocketModule {
    public readonly name = 'NotificationSocketModule';

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: any,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: any,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: any
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info(`[${this.name}] Initializing notification socket module...`);

        // Subscribe to notification.created events
        await this.eventBus.subscribe('notification.created', this.createNotificationHandler());

        logger.info(`[${this.name}] Subscribed to notification.created events`);
    }

    /**
     * Handler that broadcasts notifications to the recipient's personal room
     */
    private createNotificationHandler(): IEventHandler<NotificationCreatedEvent> {
        return {
            handle: async (event: NotificationCreatedEvent) => {
                const { recipient, notificationId, title, content, read, link, createdAt } = event.payload;

                if (!recipient) {
                    logger.warn(`[${this.name}] Notification has no recipient, skipping broadcast`);
                    return;
                }

                const notification = {
                    _id: notificationId,
                    title,
                    content,
                    read,
                    link,
                    createdAt
                };

                // Emit to user's personal notification room
                const userRoom = `user:${recipient}`;
                logger.info(`[${this.name}] Sending notification to user ${recipient}`);
                this.emitToRoom(userRoom, 'notification', notification);
            }
        };
    }

    onConnection(connection: ISocketConnection): void {
        const user = connection.user;
        if (!user) return;

        const userRoom = `user:${user._id}`;
        this.joinRoom(connection.id, userRoom);
        logger.info(`[${this.name}] User ${user._id} joined notification room: ${userRoom}`);

        this.onDisconnect(connection.id, async () => {
            logger.info(`[${this.name}] User ${user._id} left notification room`);
        });
    }
}
