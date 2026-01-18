import 'reflect-metadata';
import './core/env';
import './core/bootstrap/register-deps';

import { initializeRedis, redis } from './core/redis';
import { initializeMinio } from './core/minio';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
import { container } from 'tsyringe';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import SocketGateway from './modules/socket/infrastructure/gateway/SocketGateway';
import mountHttpRoutes from './core/bootstrap/mount-http-routes';
import startQueues from './core/bootstrap/start-queues';
import app from './core/express';
import http from 'http';
import os from 'node:os';

const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = parseInt(process.env.SERVER_TIMEOUT ?? '1800000');

const shutdown = async () => {
    process.exit(0);
};

process.on('unhandledRejection', (reason: any) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`@server: unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@server: uncaught exception: ${error.stack || error.message}`);
});

const startServer = async () => {
    const server = http.createServer(app);
    app.use(mountHttpRoutes());

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_TIMEOUT;
    server.headersTimeout = SERVER_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`)
    });

    server.listen(SERVER_PORT as number, SERVER_HOST, async () => {
        const clusterId = process.env.CLUSTER_ID || os.hostname();
        await Promise.all([
            initializeRedis(),
            mongoConnector(),
            initializeMinio()
        ]);

        if (redis) {
            await redis.zadd('active_clusters', Date.now(), clusterId);
            logger.info(`@server: registered ${clusterId} to active_clusters`);
        }

        await registerAllSubscribers();

        const socketGateway = container.resolve(SocketGateway);
        const socketModules = container.resolveAll<any>('SocketModule');
        for (const module of socketModules) {
            socketGateway.register(module);
        }
        await socketGateway.initialize(server);

        await startQueues();

        logger.info(`@server: running at http://${SERVER_HOST}:${SERVER_PORT}/`);

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    });
};

startServer();