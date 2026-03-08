import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';
import logger from '@shared/infrastructure/logger';
import { inject, singleton } from 'tsyringe';
import type NotificationCreatedEvent from '@modules/notification/domain/events/NotificationCreatedEvent';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';

@singleton()
export default class NotificationSocketModule extends BaseSocketModule {
    public readonly name = 'NotificationSocketModule';

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        logger.info(`[${this.name}] Initializing notification socket module...`);
        await this.eventBus.subscribe('notification.created', this.createNotificationHandler());
        logger.info(`[${this.name}] Subscribed to notification.created events`);
    }

    private createNotificationHandler(): IEventHandler<NotificationCreatedEvent> {
        return {
            handle: async (event: NotificationCreatedEvent) => {
                const { recipient, _id, title, content, read, link, createdAt } = event.payload;

                if (!recipient) {
                    logger.warn(`[${this.name}] Notification has no recipient, skipping broadcast`);
                    return;
                }

                const notification = {
                    _id,
                    title,
                    content,
                    read,
                    link,
                    createdAt
                };

                this.emitToRoom(`user:${recipient}`, 'notification', notification);
            }
        };
    }

    onConnection(connection: ISocketConnection): void {
        const user = connection.user;
        if (!user) {
            return;
        }

        const userRoom = `user:${user._id}`;
        this.joinRoom(connection.id, userRoom);
        logger.info(`[${this.name}] User ${user._id} joined notification room: ${userRoom}`);

        this.onDisconnect(connection.id, async () => {
            logger.info(`[${this.name}] User ${user._id} left notification room`);
        });
    }
}
