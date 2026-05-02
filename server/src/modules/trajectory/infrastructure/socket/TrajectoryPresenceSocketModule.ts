import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { PresenceUser } from '@modules/socket/domain/port/ISocketRoomManager';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';

interface TrajectoryPresencePayload extends Record<string, unknown> {
    trajectoryId: string;
}

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TrajectoryPresenceSocketModule extends BaseSocketModule {
    public readonly name = 'TrajectoryPresenceSocketModule';

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        if (!connection.user) {
            return;
        }

        this.registerJoin(connection);
        this.registerLeave(connection);
        this.wirePresenceOnDisconnect(
            connection,
            (conn) => this.getTrajectoryRoom(conn),
            'trajectory.presence.update',
            this.toPresenceUser
        );
    }

    private registerJoin(connection: ISocketConnection): void {
        this.wirePresenceSubscription<TrajectoryPresencePayload>(connection, {
            event: 'trajectory.presence.join',
            roomOf: (payload) => this.buildRoomId(payload.trajectoryId),
            previousOf: (payload) => {
                const prevId = connection.data['trajectoryId'] as string | undefined;
                return prevId && prevId !== payload.trajectoryId
                    ? this.buildRoomId(prevId)
                    : undefined;
            },
            setContext: (conn, payload) => {
                conn.data['trajectoryId'] = payload.trajectoryId;
            },
            updateEvent: 'trajectory.presence.update',
            userExtractor: this.toPresenceUser
        });
    }

    private registerLeave(connection: ISocketConnection): void {
        this.on<TrajectoryPresencePayload>(
            connection.id,
            'trajectory.presence.leave',
            async (conn, payload) => {
                const room = this.buildRoomId(payload.trajectoryId);
                await this.leaveRoom(conn.id, room);

                if (conn.data['trajectoryId'] === payload.trajectoryId) {
                    delete conn.data['trajectoryId'];
                }

                await this.broadcastPresence(room, 'trajectory.presence.update', this.toPresenceUser);
            }
        );
    }

    private buildRoomId(trajectoryId: string): string {
        return `trajectory-presence-${trajectoryId}`;
    }

    private getTrajectoryRoom(connection: ISocketConnection): string | undefined {
        const id = connection.data['trajectoryId'] as string | undefined;
        return id ? this.buildRoomId(id) : undefined;
    }

    private readonly toPresenceUser = (connection: ISocketConnection): PresenceUser => ({
        id: connection.user?._id ?? connection.id,
        firstName: connection.user?.firstName,
        lastName: connection.user?.lastName,
        isAnonymous: !connection.user
    });
}
