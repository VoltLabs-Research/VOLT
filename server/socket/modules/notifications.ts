import { Server, Socket } from 'socket.io';
import { createRedisClient } from '@/config/redis';
import BaseSocketModule from '@/socket/base-socket-module';
import Redis from 'ioredis';
import logger from '@/logger';

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
        logger.info(`[${this.name}] Notifications socket module initialized`);

        this.subscriber = createRedisClient();
        await this.subscriber.subscribe('notification:created');

        this.subscriber.on('message', (channel: string, message: string) => {
            if(channel === 'notification:created'){
                try{
                    const data = JSON.parse(message);
                    const { userId, notification } = data;

                    // Emit to user's personal notification room
                    this.io!.to(`user:${userId}`).emit('new_notification', notification);
                    logger.info(`[${this.name}] Notification sent to user ${userId}`);
                }catch(error: any){
                    logger.error(`[${this.name}] Error processing notification event: ${error}`);
                }
            }
        });
    }

    onConnection(socket: Socket): void{
        const user = (socket as any).user;
        if(!user) return;

        const userRoom = `user:${user._id}`;
        socket.join(userRoom);
        logger.info(`[${this.name}] User ${user._id} joined notification room: ${userRoom}`);

        socket.on('disconnect', () => {
            logger.info(`[${this.name}] User ${user._id} left notification room`);
        });
    }

    async onShutdown(): Promise<void>{
        if(this.subscriber){
            await this.subscriber.unsubscribe();
            await this.subscriber.quit();
        }

        logger.info(`[${this.name}] Notifications socket module shut down`);
    }
}
