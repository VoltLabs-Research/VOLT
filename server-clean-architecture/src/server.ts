import 'reflect-metadata';
import './core/env';
import { initializeRedis, redis } from './core/redis';
import { initializeMinio } from './core/minio';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
// bootstrap import moved to dynamic import inside startServer to ensure DI order
import { registerDependencies } from './core/di';
import http from 'http';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import os from 'node:os';
import { container } from 'tsyringe';
import SocketGateway from './modules/socket/infrastructure/gateway/SocketGateway';

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
    registerDependencies();

    // Dynamically import bootstrap after dependencies are registered
    const { mountAllRoutes, startJobQueues } = await import('./core/bootstrap');

    const { default: app } = await import('./core/express');
    const server = http.createServer(app);
    app.use(mountAllRoutes());

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

        await startJobQueues();

        logger.info(`@server: running at http://${SERVER_HOST}:${SERVER_PORT}/`);

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    });
};

startServer();