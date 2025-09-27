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

class TrajectoryModule extends BaseSocketModule{
    constructor(){
        super('TrajectoryModule');
    }

    onConnection(socket: Socket): void{
        this.wirePresenceSubscription(socket, {
            event: 'subscribe_to_trajectory',
            roomOf: (payload: { trajectoryId?: string }) => payload.trajectoryId,
            previousOf: (payload: { trajectoryId?: string }) => payload.trajectoryId,
            setContext: (socket, payload: { trajectoryId?: string, user?: any }) => {
                socket.data.trajectoryId = payload.trajectoryId;
                socket.data.user = payload.user;
            },
            updateEvent: 'trajectory_users_update'
        });

        this.wirePresenceOnDisconnect(
            socket,
            (socket) => socket.data?.trajectoryId as string | undefined,
            'trajectory_users_update'
        );
    }
}

export default TrajectoryModule;