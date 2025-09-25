/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

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
        socket.on('cursor:join', async ({ room, user }: { room?: string; user?: any }) => {
            if(!room){
                return;
            }

            // cache minimal context to re-emit on disconnect
            socket.data.cursorRoom = room;
            socket.data.user = user;

            this.joinRoom(socket, room);

            // Announce to others
            this.io?.to(room).emit('cursor:user-joined', {
                id: socket.id,
                user
            });
        });

        /**
         * Relay cursor movement to the whole room
         */
        socket.on('cursor:move', ({ room, x, y, ts }: { room?: string, x: Number, y: number, ts?: number }) => {
            if(!room){
                return;
            }

            const when = typeof ts === 'number' ? ts : Date.now();

            // Broadcast to room (including sender is useful for "authoritative echo").
            this.io?.to(room).emit('cursor:move', {
                id: socket.id,
                x,
                y,
                ts: when
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