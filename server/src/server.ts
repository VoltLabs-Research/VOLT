import 'reflect-metadata';
import './core/config/env';
import './shared/infrastructure/logging/installOutputDuplicateGuard';

import { registerAllDependencies } from './core/bootstrap/register-deps';
import { initializeMinio } from './core/config/minio';
import { initializeRedis } from './core/config/redis';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
import { SOCKET_TOKENS } from './modules/socket/infrastructure/di/SocketTokens';
import { ContainerVncGatewayService } from './modules/container/infrastructure/services/ContainerVncGatewayService';
import { ContainerPortProxyService } from './modules/container/infrastructure/services/ContainerPortProxyService';
import { ScriptingJupyterProxyService } from './modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import { httpErrorMiddleware } from './shared/infrastructure/http/middleware/error';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import { readNumberEnv } from './shared/infrastructure/utilities/env';
import app from './core/config/express';
import apiDocsRouter from './core/config/api-docs';
import SocketGateway from './modules/socket/socket/SocketGateway';
import http from 'http';
import { container } from 'tsyringe';
import type { ISocketModule } from './modules/socket/domain/port/ISocketModule';
import type { Duplex } from 'node:stream';

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

    app.use('/api-docs', apiDocsRouter);
    app.use(mountHttpRoutes());
    app.use(httpErrorMiddleware);

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_TIMEOUT;
    server.headersTimeout = SERVER_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`);
    });

    server.on('upgrade', (request, socket, head) => {
        const proxyService = container.resolve(ScriptingJupyterProxyService);
        if (!proxyService.isJupyterUpgradeRequest(request)) {
            const vncGatewayService = container.resolve(ContainerVncGatewayService);
            if (!vncGatewayService.isVncUpgradeRequest(request)) {
                const containerPortProxyService = container.resolve(ContainerPortProxyService);
                if (!containerPortProxyService.isContainerPortUpgradeRequest(request)) {
                    return;
                }

                containerPortProxyService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
                    logger.error(`@server: container port upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
                    (socket as Duplex).destroy();
                });
                return;
            }

            vncGatewayService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
                logger.error(`@server: vnc upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
                vncGatewayService.handleUpgradeError(socket as Duplex, error);
            });
            return;
        }

        proxyService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
            logger.error(`@server: jupyter upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
            (socket as Duplex).destroy();
        });
    });

    server.listen(SERVER_PORT, SERVER_HOST, async () => {
        try {
            const [redisResult, mongoResult, minioResult] = await Promise.allSettled([
                initializeRedis(),
                mongoConnector(),
                initializeMinio()
            ]);

            const failures: string[] = [];

            if (redisResult.status === 'rejected') {
                logger.error(`@server: Redis init failed: ${redisResult.reason}`);
                failures.push('Redis');
            }

            if (mongoResult.status === 'rejected') {
                logger.error(`@server: MongoDB init failed: ${mongoResult.reason}`);
                failures.push('MongoDB');
            }

            if (minioResult.status === 'rejected') {
                logger.error(`@server: MinIO init failed: ${minioResult.reason}`);
                failures.push('MinIO');
            }

            if (failures.length > 0) {
                logger.error(`@server: critical dependencies failed (${failures.join(', ')}), shutting down`);
                process.exit(1);
            }

            await registerAllSubscribers();

            const socketGateway = container.resolve<SocketGateway>(SOCKET_TOKENS.SocketGateway);
            const socketModules = container.resolveAll<ISocketModule>(SOCKET_TOKENS.SocketModule);
            for (const module of socketModules) {
                socketGateway.register(module);
            }

            await socketGateway.initialize(server);
            logger.info(`@server: SocketGateway ready on :${SERVER_PORT}`);

            logger.info(`@server: running at http://${SERVER_HOST}:${SERVER_PORT}/`);

            process.on('SIGTERM', shutdown);
            process.on('SIGINT', shutdown);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.stack || error.message : String(error);
            logger.error(`@server: startup error: ${message}`);
            process.exit(1);
        }
    });
};

startServer();
