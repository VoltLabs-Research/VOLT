import 'reflect-metadata';
import './core/config/env';

import { registerAllDependencies } from './core/bootstrap/register-deps';
import { initializeMinio } from './core/config/minio';
import { initializeRedis, redis } from './core/config/redis';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
import { SOCKET_TOKENS } from './modules/socket/infrastructure/di/SocketTokens';
import { httpErrorMiddleware } from './shared/infrastructure/http/middleware/error';
import { readNumberEnv } from './shared/infrastructure/utilities/env';
import app from './core/config/express';
import startQueues from './core/bootstrap/start-queues';
import SocketGateway from './modules/socket/infrastructure/gateway/SocketGateway';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import http from 'http';
import os from 'node:os';
import { container } from 'tsyringe';
import type { ISocketModule } from './modules/socket/domain/port/ISocketModule';

const SERVER_PORT = readNumberEnv('SERVER_PORT', 8000);
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = readNumberEnv('SERVER_TIMEOUT', 1800000);

registerAllDependencies();

const shutdown = async () => {
    process.exit(0);
};

process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`@server: unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@server: uncaught exception: ${error.stack || error.message}`);
});

const startServer = async () => {
    const { default: mountHttpRoutes } = await import('./core/bootstrap/mount-http-routes');
    
    const server = http.createServer(app);
    app.use(mountHttpRoutes());
    app.use(httpErrorMiddleware);

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_TIMEOUT;
    server.headersTimeout = SERVER_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`)
    });

    server.listen(SERVER_PORT, SERVER_HOST, async () => {
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

        const socketGateway = container.resolve<SocketGateway>(SOCKET_TOKENS.SocketGateway);
        const socketModules = container.resolveAll<ISocketModule>(SOCKET_TOKENS.SocketModule);
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
