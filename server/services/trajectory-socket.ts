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

import { Server, Socket } from 'socket.io';

class TrajectorySocketService {
    public initialize(io: Server): void {
        io.on('connection', (socket) => {
            this.onConnection(socket);
        });
    }

    private onConnection(socket: Socket): void {
        socket.on('subscribe_to_trajectory', ({ teamId, trajectoryId, user, previousTrajectoryId }) => {
            const room = `${teamId}-${trajectoryId}`;
            const oldRoom = previousTrajectoryId ? `${teamId}-${previousTrajectoryId}` : null;

            if (oldRoom) {
                socket.leave(oldRoom);
                console.log(`[Socket] Socket ${socket.id} left room: ${oldRoom}`);
            }

            if (teamId && trajectoryId) {
                socket.join(room);
                console.log(`[Socket] Socket ${socket.id} joined room: ${room} with user:`, user);
            }
        });
    }
}

const trajectorySocketService = new TrajectorySocketService();

export default trajectorySocketService;
