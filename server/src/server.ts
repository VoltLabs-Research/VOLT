import 'reflect-metadata';
import './core/config/env';
import './shared/infrastructure/logging/installOutputDuplicateGuard';

import { registerAllDependencies } from './core/bootstrap/register-deps';
import { initializeMinio } from './core/config/minio';
import { initializeRedis } from './core/config/redis';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
import { SOCKET_TOKENS } from './modules/socket/infrastructure/di/SocketTokens';
import { TEAM_CLUSTER_TOKENS } from './modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { ContainerXrdpGatewayService } from './modules/container/infrastructure/services/ContainerXrdpGatewayService';
import { ScriptingJupyterProxyService } from './modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import type TeamClusterTcpExposureRelayService from './modules/team-cluster/infrastructure/services/TeamClusterTcpExposureRelayService';
import { httpErrorMiddleware } from './shared/infrastructure/http/middleware/error';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import { readNumberEnv } from './shared/infrastructure/utilities/env';
import app from './core/config/express';
import SocketGateway from './modules/socket/socket/SocketGateway';
import http from 'http';
import { container } from 'tsyringe';
import type { ISocketModule } from './modules/socket/domain/port/ISocketModule';
import type { Duplex } from 'node:stream';

const SERVER_PORT = readNumberEnv('SERVER_PORT', 8000);
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = readNumberEnv('SERVER_TIMEOUT', 1800000);

registerAllDependencies();
const tcpExposureRelayService = container.resolve<TeamClusterTcpExposureRelayService>(TEAM_CLUSTER_TOKENS.TeamClusterTcpExposureRelayService);

const shutdown = async () => {
    await tcpExposureRelayService.stop();
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
        logger.error(`@server: http server error: ${error}`);
    });

    server.on('upgrade', (request, socket, head) => {
        const proxyService = container.resolve(ScriptingJupyterProxyService);
        if (!proxyService.isJupyterUpgradeRequest(request)) {
            return;
        }

        proxyService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
            logger.error(`@server: jupyter upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
            (socket as Duplex).destroy();
        });
    });

    // XRDP gateway uses noServer mode; its upgrade handler is
    // registered inside attach() and only handles its own path,
    // so it won't interfere with Socket.IO WebSocket upgrades.
    const xrdpGatewayService = container.resolve(ContainerXrdpGatewayService);
    xrdpGatewayService.attach(server);

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

            tcpExposureRelayService.start();

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
