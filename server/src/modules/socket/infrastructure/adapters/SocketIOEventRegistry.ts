import { Socket } from 'socket.io';
import { inject, injectable } from 'tsyringe';
import { ISocketEventRegistry, SocketEventHandler } from '@modules/socket/domain/ports/ISocketEventRegistry';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import { ISocketMapper } from '@modules/socket/domain/ports/ISocketMapper';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';

/**
 * Handles event registration and provides connection abstraction.
 */
@injectable()
export default class SocketIOEventRegistry implements ISocketEventRegistry{
    private sockets: Map<string, Socket> = new Map();

    constructor(
        @inject(SOCKET_TOKENS.SocketMapper)
        private readonly socketMapper: ISocketMapper
    ){}

    /**
     * Register a socket for event handling.
     */
    registerSocket(socket: Socket): void{
        this.sockets.set(socket.id, socket);
    }

    /**
     * Unregister a socket when disconnected.
     */
    unregisterSocket(socketId: string): void{
        this.sockets.delete(socketId);
    }

    on<T = unknown>(
        socketId: string,
        event: string,
        handler: SocketEventHandler<T>
    ): void{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        socket.on(event, async (payload: T) => {
            const connection = this.socketMapper.toDomain(socket);
            await handler(connection, payload);
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

        socket.on('disconnect', async () => {
            const connection = this.socketMapper.toDomain(socket);
            await handler(connection);
        });
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