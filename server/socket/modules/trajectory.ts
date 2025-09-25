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
import BaseSocketModule from '@/socket/base-socket-module';

class TrajectoryModule extends BaseSocketModule{
    private io?: Server;

    constructor(){
        super('TrajectoryModule');
    }

    onInit(io: Server): void{
        this.io = io;
    }

    onConnection(socket: Socket): void{
        socket.on('subscribe_to_trajectory', async ({ trajectoryId, user, previousTrajectoryId }) => {
            if(previousTrajectoryId){
                this.leaveRoom(socket, previousTrajectoryId);
                await this.broadcastUsers(previousTrajectoryId);
            }

            if(trajectoryId){
                socket.data.trajectoryId = trajectoryId;
                socket.data.user = user;
                this.joinRoom(socket, trajectoryId);

                await this.broadcastUsers(trajectoryId);
            }
        });

        socket.on('disconnect', async () => {
            const trajectoryId: string | undefined = socket?.data?.trajectoryId;
            if(trajectoryId){
                await this.broadcastUsers(trajectoryId);
            }
        });
    }

    private async collectUsers(room: string): Promise<any>{
        if(!this.io) return [];

        const sockets = await this.io.in(room).fetchSockets();

        const byId = new Map<string, any>();
        for(const socket of sockets){
            const user: any = socket.data?.user || {};
            const uid = (user.id as string) || socket.id;
            if(!uid) continue;

            if(!byId.has(uid)){
                byId.set(uid, {
                    id: uid,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName
                });
            }
        }

        return Array.from(byId.values());
    }

    private async emitUsers(room: string, users: any): Promise<void>{
        this.io?.to(room).emit('trajectory_users_update', users);
    }

    private async broadcastUsers(room: string): Promise<void>{
        const users = await this.collectUsers(room);
        await this.emitUsers(room, users);
    }
}

export default TrajectoryModule;