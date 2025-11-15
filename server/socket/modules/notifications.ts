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
import { createRedisClient } from '@/config/redis';
import BaseSocketModule from '@/socket/base-socket-module';
import Redis from 'ioredis';

/**
 * Socket module for real-time notifications.
 * Users join their personal notification room and receive notifications in real-time
 */
export default class NotificationsSocketModule extends BaseSocketModule{
    private subscriber?: Redis;
    
    constructor(){
        super('notifications');
    }

    async onInit(io: Server): Promise<void>{
        this.io = io;
        console.log(`[${this.name}] Notifications socket module initialized`);

        this.subscriber = createRedisClient();
        await this.subscriber.subscribe('notification:created');

        this.subscriber.on('message', (channel: string, message: string) => {
            if(channel === 'notification:created'){
                try{
                    const data = JSON.parse(message);
                    const { userId, notification } = data;

                    // Emit to user's personal notification room
                    this.io!.to(`user:${userId}`).emit('new_notification', notification);
                    console.log(`[${this.name}] Notification sent to user ${userId}`);
                }catch(error: any){
                    console.error(`[${this.name}] Error processing notification event:`, error);
                }
            }
        });
    }

    onConnection(socket: Socket): void{
        const user = (socket as any).user;
        if(!user) return;

        const userRoom = `user:${user._id}`;
        socket.join(userRoom);
        console.log(`[${this.name}] User ${user._id} joined notification room: ${userRoom}`);

        socket.on('disconnect', () => {
            console.log(`[${this.name}] User ${user._id} left notification room`);
        });
    }

    async onShutdown(): Promise<void>{
        if(this.subscriber){
            await this.subscriber.unsubscribe();
            await this.subscriber.quit();
        }

        console.log(`[${this.name}] Notifications socket module shut down`);
    }
}