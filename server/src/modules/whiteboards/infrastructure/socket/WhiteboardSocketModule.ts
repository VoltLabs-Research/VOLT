import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';
import { inject } from 'tsyringe';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager, PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';

interface SubscribePayload extends Record<string, unknown> {
    whiteboardId: string;
};

interface WhiteboardDeltaPayload {
    whiteboardId: string;
    elements: unknown[];
    appState: Record<string, unknown>;
    version: number;
};

@injectable()
export default class WhiteboardSocketModule extends BaseSocketModule {
    public readonly name = 'WhiteboardSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerSubscribe(connection);
        this.registerUnsubscribe(connection);
        this.registerDelta(connection);
        this.wirePresenceOnDisconnect(
            connection,
            (conn) => this.getWhiteboardRoom(conn),
            'whiteboard_users_update',
            this.toPresenceUser
        );
    }

    private registerSubscribe(connection: ISocketConnection): void {
        this.wirePresenceSubscription<SubscribePayload>(connection, {
            event: 'subscribe_to_whiteboard',
            roomOf: (payload) => this.buildRoomId(payload.whiteboardId),
            previousOf: (payload) => {
                const prevId = (connection.data['whiteboardId'] as string | undefined);
                return prevId && prevId !== payload.whiteboardId
                    ? this.buildRoomId(prevId)
                    : undefined;
            },
            setContext: (conn, payload) => {
                conn.data['whiteboardId'] = payload.whiteboardId;
            },
            updateEvent: 'whiteboard_users_update',
            userExtractor: this.toPresenceUser
        });
    }

    private registerUnsubscribe(connection: ISocketConnection): void {
        this.on<SubscribePayload>(connection.id, 'unsubscribe_from_whiteboard', async (conn, payload) => {
            const room = this.buildRoomId(payload.whiteboardId);
            await this.leaveRoom(conn.id, room);

            delete conn.data['whiteboardId'];

            await this.broadcastPresence(room, 'whiteboard_users_update', this.toPresenceUser);

            logger.info(`@whiteboard-socket - user ${conn.user?._id} unsubscribed from ${room}`);
        });
    }

    private registerDelta(connection: ISocketConnection): void {
        this.on<WhiteboardDeltaPayload>(connection.id, 'whiteboard_delta', (conn, payload) => {
            if (!conn.user) {
                return;
            }

            const room = this.buildRoomId(payload.whiteboardId);
            this.emitToRoomExcept(conn.id, room, 'whiteboard_delta', {
                ...payload,
                senderId: conn.user._id
            });
        });
    }

    private buildRoomId(whiteboardId: string): string {
        return `whiteboard-${whiteboardId}`;
    }

    private getWhiteboardRoom(connection: ISocketConnection): string | undefined {
        const id = connection.data['whiteboardId'] as string | undefined;
        return id ? this.buildRoomId(id) : undefined;
    }

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        isAnonymous: !connection.user
    });
};
