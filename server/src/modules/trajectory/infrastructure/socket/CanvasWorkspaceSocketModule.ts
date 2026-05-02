import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import CanvasWorkspaceRealtimeStateService from '@modules/trajectory/infrastructure/services/canvas/CanvasWorkspaceRealtimeStateService';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';

interface TrajectoryRoomPayload extends Record<string, unknown> {
    trajectoryId: string;
}

interface WorkspaceRoomPayload extends Record<string, unknown> {
    trajectoryId: string;
    ownerId: string;
}

interface WorkspacePatchPayload extends WorkspaceRoomPayload {
    patch?: Record<string, unknown>;
}

interface WorkspaceSnapshotPayload extends WorkspaceRoomPayload {
    state?: Record<string, unknown>;
}

interface WorkspaceCursorPayload extends WorkspaceRoomPayload {
    x: number;
    y: number;
}

interface WorkspaceModelDragPayload extends WorkspaceRoomPayload {
    x: number;
    y: number;
    z: number;
}

interface ConnectionContext {
    lobbyTrajectoryId?: string;
    workspaceTrajectoryId?: string;
    workspaceOwnerId?: string;
    ownedTrajectoryId?: string;
}

const LOBBY_PREFIX = 'trajectory-canvas-lobby';
const WORKSPACE_PREFIX = 'trajectory-canvas-workspace';

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class CanvasWorkspaceSocketModule extends BaseSocketModule {
    public readonly name = 'CanvasWorkspaceSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly realtimeState: CanvasWorkspaceRealtimeStateService
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerJoinLobby(connection);
        this.registerLeaveLobby(connection);
        this.registerVisitWorkspace(connection);
        this.registerLeaveWorkspace(connection);
        this.registerPublishSnapshot(connection);
        this.registerApplyPatch(connection);
        this.registerCursor(connection);
        this.registerModelDrag(connection);
        this.registerDisconnect(connection);
    }

    private registerJoinLobby(connection: ISocketConnection): void {
        this.on<TrajectoryRoomPayload>(connection.id, 'canvas.lobby.join', async (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId)) {
                return;
            }

            const ctx = this.ctx(conn);
            const nextLobby = this.lobbyRoom(payload.trajectoryId);
            const previousLobby = ctx.lobbyTrajectoryId ? this.lobbyRoom(ctx.lobbyTrajectoryId) : undefined;

            if (previousLobby && previousLobby !== nextLobby) {
                await this.leaveRoom(conn.id, previousLobby);
                await this.broadcastPresence(previousLobby, 'canvas.lobby.update', this.toPresenceUser);
            }

            await this.joinRoom(conn.id, nextLobby);
            ctx.lobbyTrajectoryId = payload.trajectoryId;

            const ownedRoom = this.workspaceRoom(payload.trajectoryId, conn.user._id);
            if (ctx.ownedTrajectoryId !== payload.trajectoryId) {
                ctx.ownedTrajectoryId = payload.trajectoryId;
                await this.joinRoom(conn.id, ownedRoom);
            }

            await this.broadcastPresence(nextLobby, 'canvas.lobby.update', this.toPresenceUser);
        });
    }

    private registerLeaveLobby(connection: ISocketConnection): void {
        this.on<TrajectoryRoomPayload>(connection.id, 'canvas.lobby.leave', async (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId)) {
                return;
            }

            const ctx = this.ctx(conn);
            const lobby = this.lobbyRoom(payload.trajectoryId);
            await this.leaveRoom(conn.id, lobby);

            if (ctx.lobbyTrajectoryId === payload.trajectoryId) {
                ctx.lobbyTrajectoryId = undefined;
            }

            await this.broadcastPresence(lobby, 'canvas.lobby.update', this.toPresenceUser);
        });
    }

    private registerVisitWorkspace(connection: ISocketConnection): void {
        this.on<WorkspaceRoomPayload>(connection.id, 'canvas.workspace.visit', async (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId) || !this.isValidId(payload.ownerId)) {
                return;
            }

            const ctx = this.ctx(conn);
            const previousRoom = ctx.workspaceTrajectoryId && ctx.workspaceOwnerId
                ? this.workspaceRoom(ctx.workspaceTrajectoryId, ctx.workspaceOwnerId)
                : undefined;

            const nextRoom = this.workspaceRoom(payload.trajectoryId, payload.ownerId);

            if (previousRoom && previousRoom !== nextRoom && ctx.workspaceOwnerId !== conn.user._id) {
                await this.leaveRoom(conn.id, previousRoom);
                await this.broadcastPresence(previousRoom, 'canvas.workspace.viewers', this.toPresenceUser);
            }

            await this.joinRoom(conn.id, nextRoom);
            ctx.workspaceTrajectoryId = payload.trajectoryId;
            ctx.workspaceOwnerId = payload.ownerId;

            const snapshot = await this.realtimeState.getSnapshot(payload.trajectoryId, payload.ownerId);
            if (snapshot) {
                this.emitToSocket(conn.id, 'canvas.workspace.sync_state', snapshot);
            } else if (payload.ownerId !== conn.user._id) {
                this.emitToSocket(conn.id, 'canvas.workspace.sync_state', {
                    trajectoryId: payload.trajectoryId,
                    ownerId: payload.ownerId,
                    revision: 0,
                    state: {},
                    updatedAt: Date.now()
                });
            }

            await this.broadcastPresence(nextRoom, 'canvas.workspace.viewers', this.toPresenceUser);
        });
    }

    private registerLeaveWorkspace(connection: ISocketConnection): void {
        this.on<WorkspaceRoomPayload>(connection.id, 'canvas.workspace.leave', async (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId) || !this.isValidId(payload.ownerId)) {
                return;
            }

            const ctx = this.ctx(conn);
            const room = this.workspaceRoom(payload.trajectoryId, payload.ownerId);

            if (payload.ownerId !== conn.user._id) {
                await this.leaveRoom(conn.id, room);
            }

            if (ctx.workspaceTrajectoryId === payload.trajectoryId && ctx.workspaceOwnerId === payload.ownerId) {
                ctx.workspaceTrajectoryId = undefined;
                ctx.workspaceOwnerId = undefined;
            }

            await this.broadcastPresence(room, 'canvas.workspace.viewers', this.toPresenceUser);
        });
    }

    private registerPublishSnapshot(connection: ISocketConnection): void {
        this.on<WorkspaceSnapshotPayload>(connection.id, 'canvas.workspace.publish_snapshot', async (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId)) {
                return;
            }

            if (payload.ownerId !== conn.user._id) {
                return;
            }

            const state = this.toRecord(payload.state);
            const snapshot = await this.realtimeState.replaceSnapshot(payload.trajectoryId, conn.user._id, state);
            const room = this.workspaceRoom(payload.trajectoryId, conn.user._id);
            this.emitToRoomExcept(conn.id, room, 'canvas.workspace.sync_state', snapshot);
        });
    }

    private registerApplyPatch(connection: ISocketConnection): void {
        this.on<WorkspacePatchPayload>(connection.id, 'canvas.workspace.patch', async (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId)) {
                return;
            }

            if (payload.ownerId !== conn.user._id) {
                return;
            }

            const patch = this.toRecord(payload.patch);
            if (Object.keys(patch).length === 0) {
                return;
            }

            const result = await this.realtimeState.applyPatch(payload.trajectoryId, conn.user._id, patch);
            if (Object.keys(result.delta).length === 0) {
                return;
            }

            const room = this.workspaceRoom(payload.trajectoryId, conn.user._id);

            this.emitToRoomExcept(conn.id, room, 'canvas.workspace.apply_patch', {
                trajectoryId: payload.trajectoryId,
                ownerId: conn.user._id,
                revision: result.revision,
                patch: result.delta,
                senderId: conn.user._id
            });
        });
    }

    private registerCursor(connection: ISocketConnection): void {
        this.on<WorkspaceCursorPayload>(connection.id, 'canvas.workspace.cursor', (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId) || !this.isValidId(payload.ownerId)) {
                return;
            }

            if (typeof payload.x !== 'number' || typeof payload.y !== 'number') {
                return;
            }

            const room = this.workspaceRoom(payload.trajectoryId, payload.ownerId);
            this.emitToRoomExcept(conn.id, room, 'canvas.workspace.cursor', {
                trajectoryId: payload.trajectoryId,
                ownerId: payload.ownerId,
                userId: conn.user._id,
                firstName: conn.user.firstName,
                lastName: conn.user.lastName,
                avatar: conn.user.avatar,
                x: payload.x,
                y: payload.y
            });
        });
    }

    private registerModelDrag(connection: ISocketConnection): void {
        this.on<WorkspaceModelDragPayload>(connection.id, 'canvas.workspace.model_drag', (conn, payload) => {
            if (!conn.user || !this.isValidId(payload.trajectoryId) || !this.isValidId(payload.ownerId)) {
                return;
            }

            if (payload.ownerId !== conn.user._id) {
                return;
            }

            if (typeof payload.x !== 'number' || typeof payload.y !== 'number' || typeof payload.z !== 'number') {
                return;
            }

            const room = this.workspaceRoom(payload.trajectoryId, payload.ownerId);
            this.emitToRoomExcept(conn.id, room, 'canvas.workspace.model_drag', {
                trajectoryId: payload.trajectoryId,
                ownerId: payload.ownerId,
                x: payload.x,
                y: payload.y,
                z: payload.z
            });
        });
    }

    private registerDisconnect(connection: ISocketConnection): void {
        this.onDisconnect(connection.id, async (conn) => {
            const ctx = this.ctx(conn);

            if (ctx.workspaceTrajectoryId && ctx.workspaceOwnerId && conn.user && ctx.workspaceOwnerId !== conn.user._id) {
                const room = this.workspaceRoom(ctx.workspaceTrajectoryId, ctx.workspaceOwnerId);
                await this.broadcastPresence(room, 'canvas.workspace.viewers', this.toPresenceUser);
            }

            if (ctx.lobbyTrajectoryId) {
                const lobby = this.lobbyRoom(ctx.lobbyTrajectoryId);
                await this.broadcastPresence(lobby, 'canvas.lobby.update', this.toPresenceUser);
            }

            if (ctx.ownedTrajectoryId && conn.user) {
                await this.teardownOwnedWorkspace(conn, ctx.ownedTrajectoryId);
            }
        });
    }

    private async teardownOwnedWorkspace(connection: ISocketConnection, trajectoryId: string): Promise<void> {
        if (!connection.user) {
            return;
        }

        const ctx = this.ctx(connection);
        if (ctx.ownedTrajectoryId !== trajectoryId) {
            return;
        }

        ctx.ownedTrajectoryId = undefined;

        const room = this.workspaceRoom(trajectoryId, connection.user._id);

        this.emitToRoom(room, 'canvas.workspace.closed', {
            trajectoryId,
            ownerId: connection.user._id
        });

        try {
            await this.realtimeState.release(trajectoryId, connection.user._id);
        } catch (error) {
            logger.warn(`@canvas-workspace - failed to release state: ${error}`);
        }
    }

    private ctx(connection: ISocketConnection): ConnectionContext {
        const existing = connection.data['canvasWorkspace'] as ConnectionContext | undefined;
        if (existing) {
            return existing;
        }

        const created: ConnectionContext = {};
        connection.data['canvasWorkspace'] = created;
        return created;
    }

    private lobbyRoom(trajectoryId: string): string {
        return `${LOBBY_PREFIX}:${trajectoryId}`;
    }

    private workspaceRoom(trajectoryId: string, ownerId: string): string {
        return `${WORKSPACE_PREFIX}:${trajectoryId}:${ownerId}`;
    }

    private isValidId(value: unknown): value is string {
        return typeof value === 'string' && value.length > 0;
    }

    private toRecord(value: unknown): Record<string, unknown> {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value as Record<string, unknown>;
        }

        return {};
    }

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        email: connection.user?.email,
        avatar: connection.user?.avatar,
        isAnonymous: !connection.user
    });
}
