import type { ErrorCode } from '@core/constants/error-codes';
import type {
    ISocketConnection,
    ISocketModule,
    PresenceUser,
    SocketEventHandler
} from '@modules/socket/socket/ISocketModule';
import SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/services/SocketIORoomManager';

export default abstract class BaseSocketModule implements ISocketModule{
    public abstract readonly name: string;

    constructor(
        protected readonly emitter: SocketIOEmitter,
        protected readonly roomManager: SocketIORoomManager,
        protected readonly eventRegistry: SocketIOEventRegistry
    ){}

    onInit(): void | Promise<void>{}

    abstract onConnection(connection: ISocketConnection): void;

    async onShutdown(): Promise<void>{}

    protected async joinRoom(socketId: string, room: string): Promise<void>{
        await this.roomManager.join(socketId, room);
    }

    protected async leaveRoom(socketId: string, room: string): Promise<void>{
        await this.roomManager.leave(socketId, room);
    }

    protected on<T = unknown, TResult = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T, TResult>
    ): void{
        this.eventRegistry.on(socketId, event, handler);
    }

    protected onDisconnect(
        socketId: string,
        handler: (connection: ISocketConnection) => void | Promise<void>
    ): void{
        this.eventRegistry.onDisconnect(socketId, handler);
    }

    protected emitToRoom(
        room: string,
        event: string,
        data: unknown
    ): void{
        this.emitter.emitToRoom(room, event, data);
    }

    protected emitToSocket(
        socketId: string,
        event: string,
        data: unknown
    ): void{
        this.emitter.emitToSocket(socketId, event, data);
    }

    protected emitErrorToSocket(
        socketId: string,
        code: ErrorCode | string,
        details?: string
    ): void {
        this.emitToSocket(socketId, 'error', {
            code,
            details
        });
    }

    protected emitToRoomExcept(
        socketId: string,
        room: string,
        event: string,
        data: unknown
    ): void {
        this.emitter.emitToRoomExcept(socketId, room, event, data);
    }

    protected async broadcastPresence(
        room: string,
        updateEvent: string,
        userExtractor: (connection: ISocketConnection) => PresenceUser
    ): Promise<void>{
        this.emitToRoom(room, updateEvent, await this.roomManager.collectPresence(room, userExtractor));
    }

    protected wirePresenceSubscription<TPayload>(
        connection: ISocketConnection,
        cfg: {
            event: string;
            roomOf: (payload: TPayload) => string | undefined;
            previousOf: (payload: TPayload) => string | undefined;
            setContext: (connection: ISocketConnection, payload: TPayload) => void;
            updateEvent: string;
            userExtractor: (connection: ISocketConnection) => PresenceUser;
        }
    ): void {
        this.on<TPayload>(connection.id, cfg.event, async (conn, payload) => {
            const prev = cfg.previousOf(payload);
            if(prev){
                await this.leaveRoom(conn.id, prev);
                await this.broadcastPresence(prev, cfg.updateEvent, cfg.userExtractor);
            }

            const room = cfg.roomOf(payload);
            if(!room) return;

            cfg.setContext(conn, payload);
            await this.joinRoom(conn.id, room);

            await this.broadcastPresence(room, cfg.updateEvent, cfg.userExtractor);
        });
    }

    protected wirePresenceOnDisconnect(
        connection: ISocketConnection,
        getRoomFromConnection: (conn: ISocketConnection) => string | undefined,
        updateEvent: string,
        userExtractor: (connection: ISocketConnection) => PresenceUser
    ): void {
        this.onDisconnect(connection.id, async (conn) => {
            const room = getRoomFromConnection(conn);
            if(room){
                await this.broadcastPresence(room, updateEvent, userExtractor);
            }
        });
    }
}
