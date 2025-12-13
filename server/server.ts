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

import http from 'http';
import app from '@config/express';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import SocketGateway from '@/socket/socket-gateway';
import JobsModule from '@/socket/modules/jobs';
import CursorModule from '@/socket/modules/cursor';
import TrajectoryModule from '@/socket/modules/trajectory';
import ChatModule from '@/socket/modules/chat';
import NotificationsModule from '@/socket/modules/notifications';
import CanvasPresenceModule from '@/socket/modules/canvas-presence';
import { initializeRedis } from '@config/redis';
import { initializeMinio } from '@/config/minio';
import MetricsModule from '@/socket/modules/metrics';
import MetricsCollector from '@/services/metrics-collector';
import logger from '@/logger';

const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';

const server = http.createServer(app);

const gateway = new SocketGateway()
    .register(new JobsModule())
    .register(new CursorModule())
    .register(new TrajectoryModule())
    .register(new ChatModule())
    .register(new NotificationsModule())
    .register(new CanvasPresenceModule())
    .register(new MetricsModule());

// Background metrics collector
let metricsCollector: MetricsCollector;
let collectionInterval: NodeJS.Timeout;
let cleanupInterval: NodeJS.Timeout;

const shutodwn = async() => {
    // Stop metrics collection
    if(collectionInterval) clearInterval(collectionInterval);
    if(cleanupInterval) clearInterval(cleanupInterval);

    await gateway.close();
    process.exit(0);
};

server.listen(SERVER_PORT as number, SERVER_HOST, async() => {
    await initializeRedis();
    await initializeMinio();
    await mongoConnector();

    // Initialize metrics collector in background
    metricsCollector = new MetricsCollector();

    // Start collecting metrics every second in background
    collectionInterval = setInterval(async() => {
        try{
            await metricsCollector.collect();
        }catch(error){
            logger.error(`[Server] Metrics collection error: ${error}`);
        }
    }, 1000);

    // Clean old metrics from Redis every 24 hours
    cleanupInterval = setInterval(async() => {
        try{
            await metricsCollector.cleanOldMetrics();
            logger.info('[Server] Cleaned old metrics from Redis');
        }catch(error){
            logger.error(`[Server] Metrics cleanup error: ${error}`);
        }
    }, 24 * 60 * 60 * 1000);

    // Run initial cleanup
    metricsCollector.cleanOldMetrics().catch(err =>
        logger.error(`[Server] Initial cleanup error: ${err}`)
    );

    logger.info('[Server] Background metrics collection started');

    // Now initialize the Socket Gateway with Redis already running
    await gateway.initialize(server);

    logger.info(`Server running at http://${SERVER_HOST}:${SERVER_PORT}/`);

    process.on('SIGTERM', shutodwn);
    process.on('SIGINT', shutodwn);
});
