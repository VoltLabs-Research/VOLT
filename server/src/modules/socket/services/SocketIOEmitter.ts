import { Server, Socket } from 'socket.io';
import logger from '@shared/infrastructure/logger';

export default class SocketIOEmitter {
    private io?: Server;
    private sockets: Map<string, Socket> = new Map();

    setServer(io: Server): void{
        this.io = io;
    }

    registerConnection(socket: unknown): void{
        this.registerSocket(socket as Socket);
    }


    private registerSocket(socket: Socket): void{
        this.sockets.set(socket.id, socket);
    }

    unregisterConnection(socketId: string): void{
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

export const socketIOEmitter = new SocketIOEmitter();
