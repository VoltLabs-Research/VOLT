import 'reflect-metadata';
import './core/config/env';

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
    const xrdpGatewayService = container.resolve(ContainerXrdpGatewayService);
    xrdpGatewayService.attach(server);

    app.use(mountHttpRoutes());
    app.use(httpErrorMiddleware);

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_TIMEOUT;
    server.headersTimeout = SERVER_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`);
    });

    // TODO: ???
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

    server.listen(SERVER_PORT, SERVER_HOST, async () => {
        await Promise.all([
            initializeRedis(),
            mongoConnector(),
            initializeMinio()
        ]);

        await registerAllSubscribers();

        const socketGateway = container.resolve<SocketGateway>(SOCKET_TOKENS.SocketGateway);
        const socketModules = container.resolveAll<ISocketModule>(SOCKET_TOKENS.SocketModule);
        for (const module of socketModules) {
            socketGateway.register(module);
        }
        await socketGateway.initialize(server);
        tcpExposureRelayService.start();

        logger.info(`@server: running at http://${SERVER_HOST}:${SERVER_PORT}/`);

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);
    });
};

startServer();
