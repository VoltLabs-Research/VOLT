import { Socket } from 'socket.io';
import { inject, injectable } from 'tsyringe';
import { ISocketEventRegistry, SocketEventHandler } from '@modules/socket/domain/port/ISocketEventRegistry';
import { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ISocketConnectionMapper } from '@modules/socket/infrastructure/contracts/ISocketConnectionMapper';
import type { ISocketEventRegistryRuntime } from '@modules/socket/infrastructure/contracts/ISocketEventRegistryRuntime';

/**
 * Handles event registration and provides connection abstraction.
 *
 * Disconnect handlers are aggregated per socket: only a single
 * `socket.on('disconnect', ...)` listener is registered regardless
 * of how many modules call `onDisconnect()`.  This avoids the
 * MaxListenersExceededWarning that would otherwise fire when > 10
 * modules each attach their own listener.
 */
@injectable()
export default class SocketIOEventRegistry implements ISocketEventRegistry, ISocketEventRegistryRuntime{
    private sockets: Map<string, Socket> = new Map();
    private disconnectHandlers: Map<string, Array<(connection: ISocketConnection) => void | Promise<void>>> = new Map();

    constructor(
        @inject(SOCKET_TOKENS.SocketConnectionMapper)
        private readonly socketMapper: ISocketConnectionMapper
    ){}

    /**
     * Register a socket for event handling.
     */
    registerConnection(socket: unknown): void{
        this.registerSocket(socket as Socket);
    }

    unregisterConnection(socketId: string): void{
        this.unregisterSocket(socketId);
    }

    private registerSocket(socket: Socket): void{
        this.sockets.set(socket.id, socket);
    }

    /**
     * Unregister a socket when disconnected.
     */
    private unregisterSocket(socketId: string): void{
        this.sockets.delete(socketId);
        this.disconnectHandlers.delete(socketId);
    }

    on<T = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T>
    ): void{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        socket.on(event, async (payload: T, ack?: (...args: unknown[]) => void) => {
            try {
                const connection = this.socketMapper.toDomain(socket);
                await handler(connection, payload);
                if(typeof ack === 'function'){
                    ack({ ok: true });
                }
            } catch(error) {
                if(typeof ack === 'function'){
                    ack({ ok: false, error: error instanceof Error ? error.message : 'Internal error' });
                }
            }
        });
    }

    off(
        socketId: string, 
        event: string
    ): void{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        socket.removeAllListeners(event);
    }

    onDisconnect(
        socketId: string, 
        handler: (connection: ISocketConnection) => void | Promise<void>
    ): void{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        let handlers = this.disconnectHandlers.get(socketId);
        if(!handlers){
            handlers = [];
            this.disconnectHandlers.set(socketId, handlers);

            // Register the single native listener that fans-out to all handlers
            socket.on('disconnect', async () => {
                const connection = this.socketMapper.toDomain(socket);
                const fns = this.disconnectHandlers.get(socketId) ?? [];
                await Promise.all(fns.map((fn) => fn(connection)));
            });
        }

        handlers.push(handler);
    }

    /**
     * Get the ISocketConnection for a socket id.
     */
    getConnection(socketId: string): ISocketConnection | undefined{
        const socket = this.sockets.get(socketId);
        if(!socket) return undefined;

        return this.socketMapper.toDomain(socket);
    }
};
