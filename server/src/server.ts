import 'reflect-metadata';
import './core/config/env';
import './shared/infrastructure/logging/installOutputDuplicateGuard';

import http from 'http';
import { createHttpTerminator, type HttpTerminator } from 'http-terminator';
import type { Duplex } from 'node:stream';
import { container } from 'tsyringe';
import { registerAllDependencies } from './core/bootstrap/register-deps';
import { startTempStorageLifecycle } from './core/bootstrap/start-temp-storage-lifecycle';
import apiDocsRouter from './core/config/api-docs';
import app from './core/config/express';
import { initializeMinio } from './core/config/minio';
import { initializeRedis } from './core/config/redis';
import { ScriptingJupyterProxyService } from './modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import type { ISocketModule } from './modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from './modules/socket/infrastructure/di/SocketTokens';
import SocketGateway from './modules/socket/socket/SocketGateway';
import ClusterTransferRunner from './modules/cluster/infrastructure/services/ClusterTransferRunner';
import { ContainerPortRelayLifecycleService } from './modules/container/infrastructure/services/ContainerPortRelayLifecycleService';
import TrajectoryCloneRunner from './modules/trajectory/infrastructure/services/trajectory/TrajectoryCloneRunner';
import { flushPendingSubscriptions } from './shared/infrastructure/events/Subscribe';
import { httpErrorMiddleware } from './shared/infrastructure/http/middleware/error';
import logger from './shared/infrastructure/logger';
import { readNumberEnv } from './shared/infrastructure/utilities/env';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import { writeUpgradeError } from './shared/infrastructure/utilities/proxy-relay';

const SERVER_PORT = readNumberEnv('SERVER_PORT', 8000);
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = readNumberEnv('SERVER_TIMEOUT', 0);
const SERVER_KEEP_ALIVE_TIMEOUT = readNumberEnv('SERVER_KEEP_ALIVE_TIMEOUT', 1800000);
const SERVER_HEADERS_TIMEOUT = readNumberEnv('SERVER_HEADERS_TIMEOUT', SERVER_KEEP_ALIVE_TIMEOUT);
const SERVER_SHUTDOWN_GRACE_PERIOD = readNumberEnv('SERVER_SHUTDOWN_GRACE_PERIOD', 1000);
const SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT = readNumberEnv('SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT', 5000);

let activeTerminator: HttpTerminator | null = null;
let activeSocketGateway: SocketGateway | null = null;
let activeClusterTransferRunner: ClusterTransferRunner | null = null;
let activeTrajectoryCloneRunner: TrajectoryCloneRunner | null = null;
let activeContainerPortRelayLifecycle: ContainerPortRelayLifecycleService | null = null;
let shuttingDown = false;

const shutdown = async () => {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    logger.info('@server: shutdown started');

    try {
        const forceExitTimer = setTimeout(() => {
            logger.error(`@server: forced shutdown timeout reached timeoutMs=${SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT}`);
            process.exit(1);
        }, SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT);
        forceExitTimer.unref();

        const socketGateway = activeSocketGateway;
        activeSocketGateway = null;

        const terminator = activeTerminator;
        activeTerminator = null;

        const shutdownTasks: Promise<unknown>[] = [];

        if (terminator) {
            shutdownTasks.push(terminator.terminate());
        }

        if (socketGateway) {
            shutdownTasks.push(socketGateway.close());
        }

        if (activeClusterTransferRunner) {
            activeClusterTransferRunner.stop();
            activeClusterTransferRunner = null;
        }

        if (activeTrajectoryCloneRunner) {
            activeTrajectoryCloneRunner.stop();
            activeTrajectoryCloneRunner = null;
        }

        if (activeContainerPortRelayLifecycle) {
            shutdownTasks.push(activeContainerPortRelayLifecycle.stop());
            activeContainerPortRelayLifecycle = null;
        }

        const shutdownResults = await Promise.allSettled(shutdownTasks);

        const firstRejectedTask = shutdownResults.find((result) => result.status === 'rejected');
        if (firstRejectedTask?.status === 'rejected') {
            throw firstRejectedTask.reason;
        }

        clearTimeout(forceExitTimer);

        logger.info('@server: shutdown complete');
        process.exit(0);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.stack || error.message : String(error);
        logger.error(`@server: shutdown error: ${message}`);
        process.exit(1);
    }
};

process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`@server: unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@server: uncaught exception: ${error.stack || error.message}`);
});

const startServer = async () => {
    await registerAllDependencies();

    await startTempStorageLifecycle();

    const { default: mountHttpRoutes } = await import('./core/bootstrap/mount-http-routes');

    const server = http.createServer(app);
    activeTerminator = createHttpTerminator({
        server,
        gracefulTerminationTimeout: SERVER_SHUTDOWN_GRACE_PERIOD
    });

    app.use('/api-docs', apiDocsRouter);
    app.use(mountHttpRoutes());
    app.use(httpErrorMiddleware);

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT;
    server.headersTimeout = SERVER_HEADERS_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`);
    });

    server.on('upgrade', (request, socket, head) => {
        const proxyService = container.resolve(ScriptingJupyterProxyService);
        if (!proxyService.isJupyterUpgradeRequest(request)) {
            (socket as Duplex).destroy();
            return;
        }

        proxyService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
            logger.error(`@server: jupyter upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
            writeUpgradeError(socket as Duplex, 500, 'WebSocket upgrade failed');
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

            await flushPendingSubscriptions();

            activeSocketGateway = container.resolve(SocketGateway);
            activeClusterTransferRunner = container.resolve(ClusterTransferRunner);
            activeTrajectoryCloneRunner = container.resolve(TrajectoryCloneRunner);
            activeContainerPortRelayLifecycle = container.resolve(ContainerPortRelayLifecycleService);
            const socketModules = container.resolveAll<ISocketModule>(SOCKET_TOKENS.SocketModule);
            for (const module of socketModules) {
                activeSocketGateway.register(module);
            }

            await activeContainerPortRelayLifecycle.start();
            await activeSocketGateway.initialize(server);
            activeClusterTransferRunner.start();
            activeTrajectoryCloneRunner.start();
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
