import { CHAT_TOKENS } from '@modules/chat/infrastructure/di/ChatTokens';
import ChatSocketEventOrchestrator from '@modules/chat/socket/chat/ChatSocketEventOrchestrator';
import ChatSocketPresenceService from '@modules/chat/socket/chat/ChatSocketPresenceService';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';

@injectable()
export default class ChatSocketModule extends BaseSocketModule {
    public readonly name = 'ChatModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        emitter: ISocketEmitter,

        @inject(SOCKET_TOKENS.SocketRoomManager)
        roomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        eventRegistry: ISocketEventRegistry,

        @inject(CHAT_TOKENS.ChatSocketPresenceService)
        private readonly presenceService: ChatSocketPresenceService,

        @inject(CHAT_TOKENS.ChatSocketEventOrchestrator)
        private readonly eventOrchestrator: ChatSocketEventOrchestrator
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onShutdown(): Promise<void> {
        await this.presenceService.shutdown();
    }

    onConnection(connection: ISocketConnection): void {
        const user = connection.user;

        if (!user) {
            return;
        }

        this.initializeConnection(connection);
    }

    private async initializeConnection(connection: ISocketConnection): Promise<void> {
        const user = connection.user;

        if (!user) {
            return;
        }

        try {
            await this.presenceService.connect(user._id, connection.id);
            await this.joinRoom(connection.id, `user-${user._id}`);

            logger.info(`@chat-socket - user connected: ${user.firstName} ${user.lastName} (${connection.id})`);

            this.eventOrchestrator.register(connection);

            this.onDisconnect(connection.id, async (conn) => {
                if (conn.user) {
                    await this.presenceService.disconnect(conn.user._id, conn.id);
                }

                logger.info(`@chat-socket - user disconnected: ${conn.user?.firstName} ${conn.user?.lastName} (${conn.id})`);
            });
        } catch (error) {
            logger.error(`@chat-socket - failed to initialize connection ${connection.id}: ${error}`);
        }
    }
};
