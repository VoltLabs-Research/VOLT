import { createRedisClient } from '@/config/redis';
import logger from '@/logger';
import { Server } from 'socket.io';

const CHANNEL = 'trajectory_updates';

export const initializeTrajectoryUpdatesListener = (io: Server) => {
    const subscriber = createRedisClient();

    subscriber.subscribe(CHANNEL, (err) => {
        if (err) {
            logger.error(`[TrajectoryUpdatesListener] Failed to subscribe to ${CHANNEL}: ${err}`);
        } else {
            logger.info(`[TrajectoryUpdatesListener] Subscribed to ${CHANNEL}`);
        }
    });

    subscriber.on('message', (channel: string, message: string) => {
        if (channel !== CHANNEL) return;

        try {
            const { trajectoryId, status, teamId, updatedAt } = JSON.parse(message);

            // Emit to all clients in the team room
            if (teamId && trajectoryId && status) {
                logger.info(`[TrajectoryUpdatesListener] Emitting trajectory update: ${JSON.stringify({ trajectoryId, status, updatedAt, teamId })}`);
                io.to(`team-${teamId}`).emit('trajectory_status_updated', {
                    trajectoryId,
                    status,
                    updatedAt,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error(`[TrajectoryUpdatesListener] Error processing message from ${CHANNEL}, Raw message: ${message}: ${error}`);
        }
    });

    subscriber.on('error', (err) => {
        logger.error(`[TrajectoryUpdatesListener] Redis subscriber error: ${err}`);
    });

    return subscriber;
};
