import 'reflect-metadata';
import './core/config/env';
import './shared/infrastructure/logging/installOutputDuplicateGuard';

import { registerAllDependencies } from './core/bootstrap/register-deps';
import { startTempStorageLifecycle } from './core/bootstrap/start-temp-storage-lifecycle';
import { backfillTeamClusterQueueConcurrency } from './core/bootstrap/backfill-team-cluster-queue-concurrency';
import { initializeMinio } from './core/config/minio';
import { initializeRedis } from './core/config/redis';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
import { SOCKET_TOKENS } from './modules/socket/infrastructure/di/SocketTokens';
import { ScriptingJupyterProxyService } from './modules/scripting/infrastructure/services/ScriptingJupyterProxyService';
import { TEAM_CLUSTER_TOKENS } from './modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ClusterTransferRunner from './modules/team-cluster/infrastructure/services/ClusterTransferRunner';
import { httpErrorMiddleware } from './shared/infrastructure/http/middleware/error';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import { readNumberEnv } from './shared/infrastructure/utilities/env';
import { writeUpgradeError } from './shared/infrastructure/utilities/proxy-relay';
import app from './core/config/express';
import apiDocsRouter from './core/config/api-docs';
import SocketGateway from './modules/socket/socket/SocketGateway';
import http from 'http';
import { container } from 'tsyringe';
import type { ISocketModule } from './modules/socket/domain/port/ISocketModule';
import type TeamClusterBinaryRelayUpgradeService from './modules/team-cluster/infrastructure/services/TeamClusterBinaryRelayUpgradeService';
import type { Duplex } from 'node:stream';
import type { Socket as NetSocket } from 'node:net';

const SERVER_PORT = readNumberEnv('SERVER_PORT', 8000);
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = readNumberEnv('SERVER_TIMEOUT', 0);
const SERVER_KEEP_ALIVE_TIMEOUT = readNumberEnv('SERVER_KEEP_ALIVE_TIMEOUT', 1800000);
const SERVER_HEADERS_TIMEOUT = readNumberEnv('SERVER_HEADERS_TIMEOUT', SERVER_KEEP_ALIVE_TIMEOUT);
const SERVER_SHUTDOWN_GRACE_PERIOD = readNumberEnv('SERVER_SHUTDOWN_GRACE_PERIOD', 1000);
const SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT = readNumberEnv('SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT', 5000);

registerAllDependencies();

let activeServer: http.Server | null = null;
let activeSocketGateway: SocketGateway | null = null;
let activeClusterTransferRunner: ClusterTransferRunner | null = null;
let shuttingDown = false;
const activeConnections = new Set<NetSocket>();

const trackConnection = (socket: NetSocket | Duplex) => {
    const trackedSocket = socket as NetSocket;
    activeConnections.add(trackedSocket);
    trackedSocket.once('close', () => {
        activeConnections.delete(trackedSocket);
    });
};

const destroyTrackedConnections = () => {
    for (const connection of activeConnections) {
        if (!connection.destroyed) {
            connection.destroy();
        }
    }

    activeConnections.clear();
};

const closeHttpServer = async (): Promise<void> => {
    if (!activeServer) {
        return;
    }

    const server = activeServer;
    activeServer = null;

    await new Promise<void>((resolve, reject) => {
        const forceCloseTimer = setTimeout(() => {
            logger.warn(`@server: force closing open HTTP connections during shutdown openConnections=${activeConnections.size} gracePeriodMs=${SERVER_SHUTDOWN_GRACE_PERIOD}`);

            server.closeAllConnections?.();
            destroyTrackedConnections();
        }, SERVER_SHUTDOWN_GRACE_PERIOD);
        forceCloseTimer.unref();

        server.close((error) => {
            clearTimeout(forceCloseTimer);

            if (error) {
                reject(error);
                return;
            }

            resolve();
        });

        server.closeIdleConnections?.();
    });
};

const shutdown = async () => {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;
    logger.info('@server: shutdown started');

    try {
        const forceExitTimer = setTimeout(() => {
            logger.error(`@server: forced shutdown timeout reached openConnections=${activeConnections.size} timeoutMs=${SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT}`);
            destroyTrackedConnections();
            process.exit(1);
        }, SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT);
        forceExitTimer.unref();

        const socketGateway = activeSocketGateway;
        activeSocketGateway = null;

        const shutdownTasks: Promise<unknown>[] = [closeHttpServer()];

        if (socketGateway) {
            shutdownTasks.push(socketGateway.close());
        }

        if (activeClusterTransferRunner) {
            activeClusterTransferRunner.stop();
            activeClusterTransferRunner = null;
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
    await startTempStorageLifecycle();

    const { default: mountHttpRoutes } = await import('./core/bootstrap/mount-http-routes');

    const server = http.createServer(app);
    activeServer = server;

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

    server.on('connection', (socket) => {
        trackConnection(socket);
    });

    server.on('upgrade', (request, socket, head) => {
        trackConnection(socket);

        const binaryRelayUpgradeService = container.resolve<TeamClusterBinaryRelayUpgradeService>(
            TEAM_CLUSTER_TOKENS.TeamClusterBinaryRelayUpgradeService
        );
        if (binaryRelayUpgradeService.isBinaryRelayUpgradeRequest(request)) {
            binaryRelayUpgradeService.handleUpgrade(request, socket as Duplex, head).catch((error: unknown) => {
                logger.error(`@server: binary relay upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
                writeUpgradeError(
                    socket as Duplex,
                    error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
                        ? error.statusCode
                        : 500,
                    error instanceof Error ? error.message : 'WebSocket upgrade failed'
                );
            });
            return;
        }

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

            await backfillTeamClusterQueueConcurrency();

            await registerAllSubscribers();

            activeSocketGateway = container.resolve<SocketGateway>(SOCKET_TOKENS.SocketGateway);
            activeClusterTransferRunner = container.resolve<ClusterTransferRunner>(TEAM_CLUSTER_TOKENS.ClusterTransferRunner);
            const socketModules = container.resolveAll<ISocketModule>(SOCKET_TOKENS.SocketModule);
            for (const module of socketModules) {
                activeSocketGateway.register(module);
            }

            await activeSocketGateway.initialize(server);
            activeClusterTransferRunner.start();
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
