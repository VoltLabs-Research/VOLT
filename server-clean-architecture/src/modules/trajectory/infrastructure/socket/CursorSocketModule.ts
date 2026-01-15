import { injectable, inject } from 'tsyringe';
import { ISocketConnection } from '@/src/modules/socket/domain/ports/ISocketModule';
import { ISocketEmitter } from '@/src/modules/socket/domain/ports/ISocketEmitter';
import { ISocketRoomManager } from '@/src/modules/socket/domain/ports/ISocketRoomManager';
import { ISocketEventRegistry } from '@/src/modules/socket/domain/ports/ISocketEventRegistry';
import { SOCKET_TOKENS } from '@/src/modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@/src/modules/socket/infrastructure/gateway/BaseSocketModule';

interface CursorUpdate{
    trajectoryId: string;
    x: number;
    y: number;
    visible?: boolean;
};

interface CursorHide{
    trajectoryId: string;
};

/**
 * Socket module for managing cursor updates in canvas collaboration.
 */
@injectable()
export default class CursorSocketModule extends BaseSocketModule{
    public readonly name = 'CursorModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        emitter: ISocketEmitter,
        
        @inject(SOCKET_TOKENS.SocketRoomManager)
        roomManager: ISocketRoomManager,
        
        @inject(SOCKET_TOKENS.SocketEventRegistry)
        eventRegistry: ISocketEventRegistry
    ){
        super(emitter, roomManager, eventRegistry);
    }

    onConnection(connection: ISocketConnection): void {
        this.on<CursorUpdate>(
            connection.id,
            'cursor_update',
            (conn, data) => {
                const room = `canvas:${data.trajectoryId}`;

                this.emitToRoomExcept(conn.id, room, 'cursor_update', {
                    id: conn.userId || conn.id,
                    firstName: conn.user?.firstName,
                    lastName: conn.user?.lastName,
                    x: data.x,
                    y: data.y,
                    visible: data.visible !== false,
                    isAnonymous: !conn.user
                });
            }
        );

        this.on<CursorHide>(
            connection.id,
            'cursor_hide',
            (conn, data) => {
                const room = `canvas:${data.trajectoryId}`;

                this.emitToRoomExcept(conn.id, room, 'cursor_update', {
                    id: conn.userId || conn.id,
                    visible: false
                });
            }
        );
    }
};
