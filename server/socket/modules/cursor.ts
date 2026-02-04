import { Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';

/**
 * Real-time cursor broadcasting.
 */
class CursorModule extends BaseSocketModule{
    constructor(){
        super('CursorModule');
    }

    onConnection(socket: Socket): void{
        /**
         * Join a cursor room and announce presence.
         */
        socket.on('cursor:join', ({ room, user }: { room?: string; user?: any }) => {
            if(!room) return;
            if(socket.data.cursorRoom === room && socket.data.user) return;
            socket.data.cursorRoom = room;
            if(user) socket.data.user = user;
            this.joinRoom(socket, room);
            socket.to(room).emit('cursor:user-joined', { id: socket.id, user: socket.data.user });
        });

        /**
         * Relay cursor movement to the whole room
         */
        socket.on('cursor:move', ({ room, nx, ny, ts }: { room?: string, nx: Number, ny: number, ts?: number }) => {
            if(!room){
                return;
            }

            const when = typeof ts === 'number' ? ts : Date.now();

            socket.to(room).emit('cursor:move', {
                id: socket.id,
                nx,
                ny,
                ts: when,
                user: socket.data.user
            });
        });

        socket.on('cursor:click', ({ room, nx, ny, ts }) => {
            if(!room) return;
            socket.to(room).emit('cursor:click', {
                id: socket.id,
                nx,
                ny,
                ts: ts ?? Date.now(),
                user: socket.data.user
            });
        });

        /**
         * On disconnect, notify the current room.
         */
        socket.on('disconnect', () => {
            const room: string | undefined = socket.data?.cursorRoom;
            if(!room){
                return;
            }

            this.io?.to(room).emit('cursor:user-left', { id: socket.id });
        });
    }
}

export default CursorModule;
