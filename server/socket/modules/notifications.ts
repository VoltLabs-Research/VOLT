import { Server, Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';
import { createRedisClient } from '@/config/redis';
import Redis from 'ioredis';

/**
 * Socket module for real-time notifications
 * Users join their personal notification room and receive notifications in real-time
 */
class NotificationsSocketModule extends BaseSocketModule {
    private subscriber?: Redis;

    constructor() {
        super('notifications');
    }

    async onInit(io: Server): Promise<void> {
        this.io = io;
        console.log(`[${this.name}] Notifications socket module initialized`);

        // Subscribe to Redis channel for notification events
        this.subscriber = createRedisClient();
        await this.subscriber.subscribe('notification:created');

        this.subscriber.on('message', (channel, message) => {
            if (channel === 'notification:created') {
                try {
                    const data = JSON.parse(message);
                    const { userId, notification } = data;
                    
                    // Emit to user's personal notification room
                    this.io.to(`user:${userId}`).emit('new_notification', notification);
                    console.log(`[${this.name}] Notification sent to user ${userId}`);
                } catch (error) {
                    console.error(`[${this.name}] Error processing notification event:`, error);
                }
            }
        });
    }

    onConnection(socket: Socket): void {
        const user = (socket as any).user;
        if (!user) return;

        // Join user to their personal notification room
        const userRoom = `user:${user._id}`;
        socket.join(userRoom);
        console.log(`[${this.name}] User ${user._id} joined notification room: ${userRoom}`);

        socket.on('disconnect', () => {
            console.log(`[${this.name}] User ${user._id} left notification room`);
        });
    }

    async onShutdown(): Promise<void> {
        if (this.subscriber) {
            await this.subscriber.unsubscribe();
            await this.subscriber.quit();
        }
        console.log(`[${this.name}] Notifications socket module shut down`);
    }
}

export default NotificationsSocketModule;
