import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createRedisClient } from '@config/redis';
import Trajectory from '@models/trajectory';

let io: SocketIOServer;

export const initializeSocketIO = (httpServer: HttpServer) => {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: [
                process.env.CLIENT_HOST as string, 
                process.env.CLIENT_DEV_HOST as string
            ],
            methods: ['GET', 'POST']
        } 
    });

    const subscriber = createRedisClient();
    const channel = 'analysis-status-updates';

    subscriber.subscribe(channel, (err) => {
        if(err){
            console.error('Failed to subscribe to Redis channel:', err);
            return; 
        }
        console.log(`Subscribed to Redis channel: ${channel}`);
    });

    subscriber.on('message', async (ch, message) => {
        if(ch === channel){
            try{
                const update = JSON.parse(message);
                const trajectory = await Trajectory.findById(update.trajectoryId).select('owner sharedWith');
                if(trajectory){
                    const userIds = [trajectory.owner.toString(), ...trajectory.sharedWith.map((id) => id.toString)];
                    userIds.forEach((userId) => {
                        io.to(userId).emit('analysisUpdate', update);
                    });
                }
            }catch(error){
                console.error('Error processing message from Redis pub/sub:', error);
            }
        }
    });

    io.on('connectiion', (socket) => {
        console.log('A user connected with socket ID:', socket.id);
        const userId = socket.handshake.query.userId as string;
        if(userId){
            socket.join(userId);
            console.log(`User ${userId} joined their personal room.`);
        }

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};

export const getIO = (): SocketIOServer => {
    if(!io){
        throw new Error('Socket.io not initialized');
    }

    return io;
}