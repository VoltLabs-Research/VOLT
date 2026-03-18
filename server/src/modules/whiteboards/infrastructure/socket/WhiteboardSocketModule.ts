import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import WhiteboardRealtimeStateService from '@modules/whiteboards/infrastructure/services/WhiteboardRealtimeStateService';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketRoomManager, PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';

interface SubscribePayload extends Record<string, unknown> {
    whiteboardId: string;
};

interface WhiteboardPatchPayload extends Record<string, unknown> {
    whiteboardId: string;
    clientId: string;
    baseRevision: number;
    elements: Record<string, unknown>[];
    appState: Record<string, unknown>;
};

@injectable()
export default class WhiteboardSocketModule extends BaseSocketModule {
    public readonly name = 'WhiteboardSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(WHITEBOARD_TOKENS.WhiteboardRealtimeStateService)
        private readonly realtimeStateService: WhiteboardRealtimeStateService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerSubscribe(connection);
        this.registerUnsubscribe(connection);
        this.registerPatch(connection);
        this.registerDisconnect(connection);
    }

    private registerSubscribe(connection: ISocketConnection): void {
        this.on<SubscribePayload>(connection.id, 'subscribe_to_whiteboard', async (conn, payload) => {
            if (typeof payload.whiteboardId !== 'string' || payload.whiteboardId.length === 0) {
                return;
            }

            const previousWhiteboardId = conn.data['whiteboardId'] as string | undefined;
            const previousRoom = previousWhiteboardId && previousWhiteboardId !== payload.whiteboardId
                ? this.buildRoomId(previousWhiteboardId)
                : undefined;

            if (previousRoom) {
                await this.leaveRoom(conn.id, previousRoom);
                await this.broadcastPresence(previousRoom, 'whiteboard_users_update', this.toPresenceUser);
                await this.releaseRoomIfIdle(previousWhiteboardId);
            }

            const room = this.buildRoomId(payload.whiteboardId);
            conn.data['whiteboardId'] = payload.whiteboardId;

            await this.joinRoom(conn.id, room);

            const snapshot = await this.realtimeStateService.getSnapshot(payload.whiteboardId);
            if (snapshot) {
                this.emitToSocket(conn.id, 'whiteboard_sync_state', snapshot);
            }

            await this.broadcastPresence(room, 'whiteboard_users_update', this.toPresenceUser);
        });
    }

    private registerUnsubscribe(connection: ISocketConnection): void {
        this.on<SubscribePayload>(connection.id, 'unsubscribe_from_whiteboard', async (conn, payload) => {
            if (typeof payload.whiteboardId !== 'string' || payload.whiteboardId.length === 0) {
                return;
            }

            const room = this.buildRoomId(payload.whiteboardId);
            await this.leaveRoom(conn.id, room);

            if (conn.data['whiteboardId'] === payload.whiteboardId) {
                delete conn.data['whiteboardId'];
            }

            await this.broadcastPresence(room, 'whiteboard_users_update', this.toPresenceUser);
            await this.releaseRoomIfIdle(payload.whiteboardId);

            logger.info(`@whiteboard-socket - user ${conn.user?._id} unsubscribed from ${room}`);
        });
    }

    private registerPatch(connection: ISocketConnection): void {
        this.on<WhiteboardPatchPayload>(connection.id, 'whiteboard_patch', async (conn, payload) => {
            if (!conn.user || typeof payload.whiteboardId !== 'string' || payload.whiteboardId.length === 0 || typeof payload.clientId !== 'string') {
                return;
            }

            const snapshot = await this.realtimeStateService.mergeScene(
                payload.whiteboardId,
                Array.isArray(payload.elements) ? payload.elements : [],
                typeof payload.appState === 'object' && payload.appState !== null ? payload.appState : {},
                conn.user._id
            );

            if (!snapshot) {
                return;
            }

            const room = this.buildRoomId(payload.whiteboardId);
            this.emitToRoom(room, 'whiteboard_sync_state', {
                ...snapshot,
                senderId: conn.user._id,
                clientId: payload.clientId,
                baseRevision: payload.baseRevision
            });
        });
    }

    private registerDisconnect(connection: ISocketConnection): void {
        this.onDisconnect(connection.id, async (conn) => {
            const whiteboardId = conn.data['whiteboardId'] as string | undefined;
            if (!whiteboardId) {
                return;
            }

            const room = this.buildRoomId(whiteboardId);
            await this.broadcastPresence(room, 'whiteboard_users_update', this.toPresenceUser);
            await this.releaseRoomIfIdle(whiteboardId);
        });
    }

    private async releaseRoomIfIdle(whiteboardId: string | undefined): Promise<void> {
        if (!whiteboardId) {
            return;
        }

        const room = this.buildRoomId(whiteboardId);
        const socketIds = await this.roomManager.getSocketsInRoom(room);
        if (socketIds.length === 0) {
            await this.realtimeStateService.flushAndRelease(whiteboardId);
        }
    }

    private buildRoomId(whiteboardId: string): string {
        return `whiteboard-${whiteboardId}`;
    }

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        isAnonymous: !connection.user
    });
}
