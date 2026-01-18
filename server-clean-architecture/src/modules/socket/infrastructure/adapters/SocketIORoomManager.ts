import { Server, Socket } from 'socket.io';
import { inject, injectable } from 'tsyringe';
import { ISocketRoomManager, PresenceUser } from '@modules/socket/domain/ports/ISocketRoomManager';
import { ISocketConnection } from '@modules/socket/domain/ports/ISocketModule';
import logger from '@shared/infrastructure/logger';
import { ISocketMapper } from '@modules/socket/domain/ports/ISocketMapper';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';

/**
 * Handles room management and presence collection.
 */
@injectable()
export default class SocketIORoomManager implements ISocketRoomManager{
    private io?: Server;
    private sockets: Map<string, Socket> = new Map();

    constructor(
        @inject(SOCKET_TOKENS.SocketMapper)
        private readonly socketMapper: ISocketMapper
    ){}

    /**
     * Initialize with the Socket.IO server instance.
     */
    setServer(io: Server): void{
        this.io = io;
    }

    /**
     * Register a socket for room management.
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

    async join(
        socketId: string,
        room: string
    ): Promise<void>{
        const socket = this.sockets.get(socketId);
        if(!socket){
            logger.warn(`@socket-io-room-manager - cannot join room: socket ${socketId} not found`);
            return;
        }

        // Socket already in the room
        if(socket.rooms.has(room)) return;

        socket.join(room);
        logger.debug(`@socket-io-room-manager - socket ${socketId} joined room: ${room}`);
    }

    async leave(
        socketId: string, 
        room: string
    ): Promise<void>{
        const socket = this.sockets.get(socketId);
        if(!socket) return;

        socket.leave(room);
        logger.debug(`@socket-io-room-manager - socket ${socketId} left room: ${room}`);
    }

    async getSocketsInRoom(room: string): Promise<string[]>{
        if(!this.io) return [];

        try{
            const sockets = await this.io.in(room).fetchSockets();
            return sockets.map((socket) => socket.id);
        }catch(error){
            logger.error(`@socket-io-room-manager: error fetching sockets for room ${room}: ${error}`);
            return [];
        }
    }

    getRoomsOfSocket(socketId: string): string[]{
        const socket = this.sockets.get(socketId);
        if(!socket) return [];
        return Array.from(socket.rooms).filter((room) => room !== socketId);
    }

    isInRoom(socketId: string, room: string): boolean{
        const socket = this.sockets.get(socketId);
        if(!socket) return false;
        return socket.rooms.has(room);
    }

    async collectPresence(
        room: string, 
        userExtractor: (connection: ISocketConnection) => PresenceUser
    ): Promise<PresenceUser[]>{
        if(!this.io) return [];

        try{
            const sockets = await this.io.in(room).fetchSockets();
            const byId = new Map<string, PresenceUser>();

            for(const socket of sockets){
                const connection = this.socketMapper.toDomain(socket);
                const presenceUser = userExtractor(connection);
                const uid = presenceUser.id;
                if(uid && !byId.has(uid)){
                    byId.set(uid, presenceUser);
                }
            }

            return Array.from(byId.values());
        }catch(error){
            logger.error(`@socket-io-room-manager - error collecting presence for room ${room}: ${error}`);
            return [];
        }
    }
};