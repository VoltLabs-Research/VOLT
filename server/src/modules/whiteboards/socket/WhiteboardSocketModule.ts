import { ErrorCodes } from '@core/constants/error-codes';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { ackError, ackOk } from '@modules/socket/socket/socket-ack';
import realtimeStateService from '@modules/whiteboards/services/WhiteboardRealtimeStateService';
import logger from '@shared/infrastructure/logger';

import type { SocketAck } from '@modules/socket/socket/socket-ack';
import type { WhiteboardAppState, WhiteboardElement } from '@modules/whiteboards/contracts/whiteboard';
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
    elements: WhiteboardElement[];
    appState: WhiteboardAppState;
    elementOrder?: string[];
}

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
            const snapshot = await realtimeStateService.getSnapshot(payload.whiteboardId);
            const teamId = await realtimeStateService.getTeamId(payload.whiteboardId);
            if (!snapshot || !teamId) {
                return this.reject(conn.id, ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
            }

            if (!conn.user?.teams?.includes(teamId)) {
                return this.reject(conn.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'You are not a member of this team');
            }

            const previousWhiteboardId = conn.data['whiteboardId'] as string | undefined;
            if (previousWhiteboardId && previousWhiteboardId !== payload.whiteboardId) {
                const previousRoom = this.buildRoomId(previousWhiteboardId);
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
            if (!conn.user) {
                return ackError('Invalid whiteboard patch payload');
            }

            const room = this.buildRoomId(payload.whiteboardId);
            if (!this.roomManager.isInRoom(conn.id, room)) {
                return this.reject(conn.id, ErrorCodes.VALIDATION_INVALID_INPUT, 'Socket is not subscribed to this whiteboard');
            }

            const teamId = await realtimeStateService.getTeamId(payload.whiteboardId);
            if (!teamId) {
                return this.reject(conn.id, ErrorCodes.RESOURCE_NOT_FOUND, 'Whiteboard not found');
            }

            if (!conn.user.teams?.includes(teamId)) {
                return this.reject(conn.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'You are not a member of this team');
            }

            const previousSnapshot = await realtimeStateService.getSnapshot(payload.whiteboardId);
            const isStalePatch = Boolean(previousSnapshot && payload.baseRevision < previousSnapshot.revision);

            const mergeResult = await realtimeStateService.mergeScene(
                payload.whiteboardId,
                payload.elements,
                payload.appState,
                conn.user._id,
                payload.elementOrder
            );

            if (!mergeResult) {
                return ackError('Whiteboard state unavailable');
            }

            // Echoed back on the ack and on the broadcast so a peer can tell its own
            // patches apart from someone else's and reconcile against its base revision.
            const origin = {
                senderId: conn.user._id,
                clientId: payload.clientId,
                baseRevision: payload.baseRevision
            };

            const delta = mergeResult.changed
                ? {
                    ...mergeResult.delta,
                    ...origin
                }
                : undefined;

            if (delta) {
                this.emitToRoomExcept(conn.id, room, 'whiteboard_apply_delta', delta);
            }

            // A patch built on an outdated revision gets the authoritative scene back.
            const snapshot = isStalePatch ? await realtimeStateService.getSnapshot(payload.whiteboardId) : null;
            if (!snapshot) {
                return ackOk({
                    accepted: true,
                    revision: mergeResult.revision,
                    delta
                });
            }

            return ackOk({
                accepted: mergeResult.changed,
                revision: snapshot.revision,
                delta,
                snapshot: {
                    ...snapshot,
                    ...origin
                }
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

    /** The last subscriber out flushes the room so its scene is not held in memory forever. */
    private async releaseRoomIfIdle(whiteboardId: string): Promise<void> {
        const socketIds = await this.roomManager.getSocketsInRoom(this.buildRoomId(whiteboardId));
        if (socketIds.length === 0) {
            await realtimeStateService.flushAndRelease(whiteboardId);
        }
    }

    private reject(socketId: string, code: string, message: string): SocketAck<never> {
        this.emitErrorToSocket(socketId, code, message);
        return ackError(message);
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
