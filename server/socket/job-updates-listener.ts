import { Server } from 'socket.io';
import logger from '@/logger';
import { eventBus, EventChannels } from '@/events/event-bus';

export const initializeJobUpdatesListener = (io: Server) => {
    eventBus.on(EventChannels.JOB_UPDATES, (message: any) => {
        try {
            const { teamId, payload } = message;
            if (!teamId || !payload) return;

            if (payload.type === 'session_completed') {
                logger.info(`[JobUpdatesListener] Session completed: ${payload.sessionId}`);
                io.to(`team-${teamId}`).emit('trajectory_session_completed', payload);
                return;
            }

            logger.info(`[JobUpdate] ${payload.jobId?.slice(-8)} | ${payload.status}`);
            io.to(`team-${teamId}`).emit('job_update', payload);

        } catch (error) {
            logger.error(`[JobUpdatesListener] Error: ${error}`);
        }
    });

    logger.info('[JobUpdatesListener] Subscribed to EventBus job updates');
};
