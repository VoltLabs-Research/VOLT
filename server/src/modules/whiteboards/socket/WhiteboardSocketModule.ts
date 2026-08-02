import { ErrorCodes } from '@core/constants/error-codes';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import realtimeStateService from '@modules/whiteboards/services/WhiteboardRealtimeStateService';
import logger from '@shared/infrastructure/logger';

import type { ISocketConnection, PresenceUser } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';

interface SubscribePayload {
    whiteboardId: string;
}

interface WhiteboardPatchPayload {
    whiteboardId: string;
    clientId: string;
    baseRevision: number;
    elements: Record<string, unknown>[];
    appState: Record<string, unknown>;
    elementOrder?: string[];
}

interface SocketAck<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
}

interface WhiteboardPatchAck {
    accepted: boolean;
    revision: number;
    delta?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
}

const ackOk = <T>(data: T): SocketAck<T> => ({
    ok: true,
    data
});
const ackError = (error: string): SocketAck<never> => ({
    ok: false,
    error
});

class WhiteboardSocketModule extends BaseSocketModule {
    public readonly name = 'WhiteboardSocketModule';

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
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
            if (payload.whiteboardId.length === 0) {
                return ackError('Invalid whiteboard id');
            }

            const snapshot = await realtimeStateService.getSnapshot(payload.whiteboardId);
            const teamId = await realtimeStateService.getTeamId(payload.whiteboardId);
            if (!snapshot || !teamId) {
                this.emitErrorToSocket(conn.id, ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
                return ackError('Whiteboard not found');
            }

            if (!conn.user?.teams?.includes(teamId)) {
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'You are not a member of this team');
                return ackError('You are not a member of this team');
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

            await this.broadcastPresence(room, 'whiteboard_users_update', this.toPresenceUser);
            return ackOk({ snapshot });
        });
    }

    private registerUnsubscribe(connection: ISocketConnection): void {
        this.on<SubscribePayload>(connection.id, 'unsubscribe_from_whiteboard', async (conn, payload) => {
            if (payload.whiteboardId.length === 0) {
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
        this.on<WhiteboardPatchPayload, SocketAck<WhiteboardPatchAck>>(connection.id, 'whiteboard_patch', async (conn, payload) => {
            if (!conn.user || payload.whiteboardId.length === 0) {
                return ackError('Invalid whiteboard patch payload');
            }

            const room = this.buildRoomId(payload.whiteboardId);
            if (!this.roomManager.isInRoom(conn.id, room)) {
                this.emitErrorToSocket(conn.id, ErrorCodes.VALIDATION_INVALID_INPUT, 'Socket is not subscribed to this whiteboard');
                return ackError('Socket is not subscribed to this whiteboard');
            }

            const teamId = await realtimeStateService.getTeamId(payload.whiteboardId);
            if (!teamId) {
                this.emitErrorToSocket(conn.id, ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
                return ackError('Whiteboard not found');
            }

            if (!conn.user.teams?.includes(teamId)) {
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'You are not a member of this team');
                return ackError('You are not a member of this team');
            }

            const previousSnapshot = await realtimeStateService.getSnapshot(payload.whiteboardId);
            const isStalePatch = Boolean(previousSnapshot && payload.baseRevision < previousSnapshot.revision);

            const mergeResult = await realtimeStateService.mergeScene(
                payload.whiteboardId,
                payload.elements,
                payload.appState,
                conn.user._id,
                payload.elementOrder?.filter((id) => id.length > 0)
            );

            if (!mergeResult) {
                return ackError('Whiteboard state unavailable');
            }

            if (!mergeResult.changed) {
                if (isStalePatch) {
                    const snapshot = await realtimeStateService.getSnapshot(payload.whiteboardId);
                    if (snapshot) {
                        return ackOk({
                            accepted: false,
                            revision: snapshot.revision,
                            snapshot: {
                                ...snapshot,
                                senderId: conn.user._id,
                                clientId: payload.clientId,
                                baseRevision: payload.baseRevision
                            }
                        });
                    }
                }
                return ackOk({
                    accepted: true,
                    revision: mergeResult.revision
                });
            }

            const socketPayload = mergeResult.delta
                ? {
                    ...mergeResult.delta,
                    senderId: conn.user._id,
                    clientId: payload.clientId,
                    baseRevision: payload.baseRevision
                }
                : undefined;

            if (socketPayload) {
                this.emitToRoomExcept(conn.id, room, 'whiteboard_apply_delta', socketPayload);
            }

            if (isStalePatch) {
                const snapshot = await realtimeStateService.getSnapshot(payload.whiteboardId);
                if (snapshot) {
                    return ackOk({
                        accepted: true,
                        revision: snapshot.revision,
                        delta: socketPayload,
                        snapshot: {
                            ...snapshot,
                            senderId: conn.user._id,
                            clientId: payload.clientId,
                            baseRevision: payload.baseRevision
                        }
                    });
                }
            }

            if (!mergeResult.delta) {
                return ackOk({
                    accepted: true,
                    revision: mergeResult.revision
                });
            }

            return ackOk({
                accepted: true,
                revision: mergeResult.revision,
                delta: socketPayload
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
            await realtimeStateService.flushAndRelease(whiteboardId);
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

export default new WhiteboardSocketModule();
