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

const CHANNEL = 'trajectory_updates';

export const initializeTrajectoryUpdatesListener = (io: Server) => {
    const subscriber = createRedisClient();

    subscriber.subscribe(CHANNEL, (err, count) => {
        if(err){
            logger.error(`[TrajectoryUpdatesListener] Failed to subscribe to ${CHANNEL}: ${err}`);
        }else{
            logger.info(`[TrajectoryUpdatesListener] Subscribed to ${count} channel(s)`);
        }
    });

    subscriber.on('message', (channel: string, message: string) => {
        if(channel !== CHANNEL) return;

        try{
            const { trajectoryId, status, teamId, updatedAt } = JSON.parse(message);

            // Emit to all clients in the team room
            if(teamId && trajectoryId && status){
                logger.info(`[TrajectoryUpdatesListener] Emitting trajectory update: ${JSON.stringify({ trajectoryId, status, updatedAt, teamId })}`);
                io.to(`team-${teamId}`).emit('trajectory_status_updated', {
                    trajectoryId,
                    status,
                    updatedAt,
                    timestamp: new Date().toISOString()
                });
            }
        }catch(error){
            logger.error(`[TrajectoryUpdatesListener] Error processing message from ${CHANNEL}, Raw message: ${message}: ${error}`);
        }
    });

    subscriber.on('error', (err) => {
        logger.error(`[TrajectoryUpdatesListener] Redis subscriber error: ${err}`);
    });

    return subscriber;
};
