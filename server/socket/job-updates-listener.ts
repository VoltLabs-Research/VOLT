/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

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

            // Emit to all clients in the team room
            if (teamId && payload) {
                // Check if this is a session completion event
                if (payload.type === 'session_completed') {
                    const sessionCompleteEvent = {
                        trajectoryId: payload.trajectoryId,
                        sessionId: payload.sessionId,
                        totalJobs: payload.totalJobs,
                        completedAt: payload.completedAt,
                        timestamp: payload.timestamp || new Date().toISOString()
                    };

                    logger.info(`[JobUpdatesListener] Emitting session completion for trajectory ${payload.trajectoryId}`);
                    io.to(`team-${teamId}`).emit('trajectory_session_completed', sessionCompleteEvent);
                    return;
                }

                // Regular job update
                const normalizedPayload = {
                    jobId: payload.jobId,
                    status: payload.status,
                    progress: payload.progress || 0,
                    chunkIndex: payload.chunkIndex,
                    totalChunks: payload.totalChunks,
                    name: payload.name,
                    message: payload.message,
                    trajectoryId: payload.trajectoryId,
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

                io.to(`team-${teamId}`).emit('job_update', normalizedPayload);
            }
        } catch (error) {
            logger.error(`[JobUpdatesListener] Error processing message from ${CHANNEL}, Raw message: ${message}: ${error}`);
        }
    });

    subscriber.on('error', (err) => {
        logger.error(`[JobUpdatesListener] Redis subscriber error: ${err}`);
    });

    return subscriber;
};
