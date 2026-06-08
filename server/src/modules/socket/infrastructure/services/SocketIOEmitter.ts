import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import { Server, Socket } from 'socket.io';

import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEmitterRuntime } from '@modules/socket/infrastructure/contracts/ISocketEmitterRuntime';
import logger from '@shared/infrastructure/logger';

/**
 * Handles all event emission through the Socket.IO server.
 */
@Singleton()
@AliasOf(SOCKET_TOKENS.SocketEmitter)
export default class SocketIOEmitter implements ISocketEmitter, ISocketEmitterRuntime{
    private io?: Server;
    private sockets: Map<string, Socket> = new Map();

    /**
     * Initialize with the Socket.IO server instance.
     * Called by SocketGateway after server creation.
     */
    setServer(io: Server): void{
        this.io = io;
    }

    registerConnection(socket: unknown): void{
        this.registerSocket(socket as Socket);
    }

    unregisterConnection(socketId: string): void{
        this.unregisterSocket(socketId);
    }

    private registerSocket(socket: Socket): void{
        this.sockets.set(socket.id, socket);
    }

    private unregisterSocket(socketId: string): void{
        this.sockets.delete(socketId);
    }

    emitToRoom(
        room: string,
        event: string,
        data: unknown
    ): void{
        if(!this.io){
            logger.warn('@socket-io-emitter - cannot emit, server not initialized');
            return;
        }

        this.io.to(room).emit(event, data);
    }

    emitToSocket(
        socketId: string, 
        event: string, 
        data: unknown
    ): void {
        const socket = this.sockets.get(socketId);

        if(socket){
            socket.emit(event, data);
            return;
        }

        // Distributed fallback (Redis adapter)
        this.io?.to(socketId).emit(event, data);
    }

    emitToRoomExcept(
        socketId: string, 
        room: string, 
        event: string, 
        data: unknown
    ): void {
        const socket = this.sockets.get(socketId);
        if(!socket) return;
        socket.to(room).emit(event, data);    
    }

    broadcast(
        event: string,
        data: unknown
    ): void{
        if(!this.io){
            logger.warn('@socket-io-emitter - cannot broadcast, server not initialized');
            return;
        }

        this.io.emit(event, data);
    }
}
