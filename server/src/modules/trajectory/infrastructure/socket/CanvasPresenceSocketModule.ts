import { injectable, inject } from 'tsyringe';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { ISocketEmitter } from '@modules/socket/domain/ports/ISocketEmitter';
import { ISocketRoomManager } from '@modules/socket/domain/ports/ISocketRoomManager';
import { ISocketEventRegistry } from '@modules/socket/domain/ports/ISocketEventRegistry';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { PresenceUser } from '@modules/socket/domain/ports/ISocketRoomManager';
import BaseSocketModule from '@modules/socket/infrastructure/gateway/BaseSocketModule';

interface PresencePayload {
    trajectoryId: string;
    previousTrajectoryId?: string;
    mode: 'canvas' | 'raster';
};

@injectable()
export default class CanvasPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'CanvasPresenceModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        emitter: ISocketEmitter,

        @inject(SOCKET_TOKENS.SocketRoomManager)
        roomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        eventRegistry: ISocketEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        const userExtractor = (conn: ISocketConnection): PresenceUser => ({
            id: conn.userId || conn.id,
            firstName: conn.user?.firstName,
            lastName: conn.user?.lastName,
            email: conn.user?.email,
            mode: conn.data.mode,
            isAnonymous: !conn.user
        });

        this.wirePresenceSubscription<PresencePayload>(connection, {
            event: 'subscribe_to_trajectory',
            roomOf: (p) => p.trajectoryId ? `${p.mode}:${p.trajectoryId}` : undefined,
            previousOf: (p) => p.previousTrajectoryId ? `${p.mode}:${p.previousTrajectoryId}` : undefined,
            setContext: (conn, p) => {
                conn.data.trajectoryId = p.trajectoryId;
                conn.data.mode = p.mode;
            },
            updateEvent: 'trajectory_users_update',
            userExtractor
        });

        this.wirePresenceOnDisconnect(
            connection,
            (conn) => conn.data.trajectoryId ? `${conn.data.mode}:${conn.data.trajectoryId}` : undefined,
            'trajectory_users_update',
            userExtractor
        );

        // Observer subscription (read-only)
        // TODO: CHECK IF THIS WORK WELL
        this.on<PresencePayload>(
            connection.id,
            'subscribe_as_observer',
            async (conn, payload) => {
                const room = `${payload.mode}-observer:${payload.trajectoryId}`;
                await this.joinRoom(conn.id, room);
                this.emitToSocket(conn.id, 'observer_subscribed', {
                    trajectoryId: payload.trajectoryId,
                    mode: payload.mode
                });
            }
        );

        this.on<void>(
            connection.id,
            'unsubscribe_from_trajectory',
            async (conn) => {
                const { trajectoryId, mode } = conn.data;
                if (trajectoryId && mode) {
                    await this.leaveRoom(conn.id, `${mode}:${trajectoryId}`);
                    conn.data.trajectoryId = undefined;
                    conn.data.mode = undefined;
                }
            }
        );
    }
}
