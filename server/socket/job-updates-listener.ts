import { createRedisClient } from '@/config/redis';
import logger from '@/logger';
import { Server } from 'socket.io';

const CHANNEL = 'job_updates';

export const initializeJobUpdatesListener = (io: Server) => {
    const subscriber = createRedisClient();

    subscriber.subscribe(CHANNEL, (err, count) => {
        if (err) {
            logger.error(`[JobUpdatesListener] Failed to subscribe to ${CHANNEL}: ${err}`);
        } else {
            logger.info(`[JobUpdatesListener] Subscribed to ${count} channel(s)`);
        }
    });

    subscriber.on('message', (channel: string, message: string) => {
        if (channel !== CHANNEL) return;

        try {
            const { teamId, payload } = JSON.parse(message);
            if (!teamId || !payload) return;

            if (payload.type === 'session_completed') {
                logger.info(`[JobUpdatesListener] Session completed: ${payload.sessionId}`);
                io.to(`team-${teamId}`).emit('trajectory_session_completed', {
                    trajectoryId: payload.trajectoryId,
                    sessionId: payload.sessionId,
                    totalJobs: payload.totalJobs,
                    completedAt: payload.completedAt,
                    timestamp: payload.timestamp || new Date().toISOString()
                });
                return;
            }

            const normalizedPayload = {
                jobId: payload.jobId,
                status: payload.status,
                progress: payload.progress || 0,
                name: payload.name,
                message: payload.message,
                trajectoryId: payload.trajectoryId,
                trajectoryName: payload.trajectoryName,
                analysisId: payload.analysisId,
                timestep: payload.timestep,
                sessionId: payload.sessionId,
                sessionStartTime: payload.sessionStartTime,
                timestamp: payload.timestamp || new Date().toISOString(),
                queueType: payload.queueType || 'unknown',
                type: payload.type,
                ...(payload.error && { error: payload.error }),
                ...(payload.result && { result: payload.result }),
                ...(payload.processingTimeMs && { processingTimeMs: payload.processingTimeMs })
            };

            logger.info(`[JobUpdate] ${payload.jobId?.slice(-8)} | ${payload.status} | Frame ${payload.timestep}`);
            io.to(`team-${teamId}`).emit('job_update', normalizedPayload);
        } catch (error) {
            logger.error(`[JobUpdatesListener] Error: ${error}`);
        }
    });

    subscriber.on('error', (err) => {
        logger.error(`[JobUpdatesListener] Redis error: ${err}`);
    });

    return subscriber;
};

