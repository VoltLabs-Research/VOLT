import { inject } from 'tsyringe';
import { ISocketModule, ISocketConnection } from '@/src/modules/socket/domain/ports/ISocketModule';
import { ISocketEmitter } from '@/src/modules/socket/domain/ports/ISocketEmitter';
import { ISocketRoomManager, PresenceUser } from '@/src/modules/socket/domain/ports/ISocketRoomManager';
import { ISocketEventRegistry, SocketEventHandler } from '@/src/modules/socket/domain/ports/ISocketEventRegistry';
import { SOCKET_TOKENS } from '../di/SocketTokens';

/**
 * Each module can hook into the lifecycle and register its own handlers.
 */
export default abstract class BaseSocketModule implements ISocketModule{
    public abstract readonly name: string;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        protected readonly emitter: ISocketEmitter,
        
        @inject(SOCKET_TOKENS.SocketRoomManager)
        protected readonly roomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        protected readonly eventRegistry: ISocketEventRegistry
    ){}

    /**
     * Called once when the module is registered in the gateway.
     * Override to perform initialization logic.
     */
    onInit(): void | Promise<void>{}

    /**
     * Called per connection if the module wants to handle the socket.
     * Override to register event handlers for the connection.
     */
    abstract onConnection(connection: ISocketConnection): void;

    /**
     * Called during graceful shutdown.
     * Override to cleanup resources like intervals or subscriptions.
     */
    async onShutdown(): Promise<void>{}

    /**
     * Join a room with the given socket.
     */
    protected async joinRoom(socketId: string, room: string): Promise<void>{
        await this.roomManager.join(socketId, room);
    }

    /**
     * Leave a room with the given socket.
     */
    protected async leaveRoom(socketId: string, room: string): Promise<void>{
        await this.roomManager.leave(socketId, room);
    }

    /**
     * Register an event handler for a socket.
     */
    protected on<T = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T>
    ): void{
        this.eventRegistry.on(socketId, event, handler);
    }

    /**
     * Register a disconnect handler for a socket.
     */
    protected onDisconnect(
        socketId: string,
        handler: (connection: ISocketConnection) => void | Promise<void>
    ): void{
        this.eventRegistry.onDisconnect(socketId, handler);
    }

    /**
     * Emit an event to a room.
     */
    protected emitToRoom(
        room: string,
        event: string,
        data: unknown
    ): void{
        this.emitter.emitToRoom(room, event, data);
    }

    /**
     * Emit an event to a specific socket.
     */
    protected emitToSocket(
        socketId: string,
        event: string,
        data: unknown
    ): void{
        this.emitter.emitToSocket(socketId, event, data);
    }

    /**
     * Emit an event to a room excluding the sender.
     */
    protected emitToRoomExcept(
        socketId: string,
        room: string,
        event: string,
        data: unknown
    ): void {
        this.emitter.emitToRoomExcept(socketId, room, event, data);
    }

    /**
     * Broadcast an event to all connected sockets.
     */
    protected broadcast(event: string, data: unknown): void{
        this.emitter.broadcast(event, data);
    }

    /**
     * Collect presence information for a room.
     */
    protected async collectPresence(
        room: string,
        userExtractor: (connection: ISocketConnection) => PresenceUser
    ): Promise<PresenceUser[]> {
        return this.roomManager.collectPresence(room, userExtractor);
    }

    /**
     * Broadcast presence update to a room.
     */
    protected async broadcastPresence(
        room: string,
        updateEvent: string,
        userExtractor: (connection: ISocketConnection) => PresenceUser
    ): Promise<void>{
        const users = await this.collectPresence(room, userExtractor);
        this.emitToRoom(room, updateEvent, users);
    }

    /**
     * Wire a subscription pattern with presence for a specific event.
     */
    protected wirePresenceSubscription<TPayload extends Record<string, any>>(
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
            const prev = cfg.previousOf?.(payload);
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

    /**
     * Register a disconnect handler that re-broadcasts presence.
     */
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
};