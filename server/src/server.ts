import './core/config/env';

import http from 'http';
import { AI_TOOL_CONTROLLERS } from './core/bootstrap/ai-tools';
import { registerAIToolControllers } from './modules/ai/services/AIToolService';
import { createHttpTerminator, type HttpTerminator } from 'http-terminator';
import { connectDatabase, disconnectDatabase } from './core/bootstrap/connect-database';
import { startRuntimeStateMaintenance, stopRuntimeStateMaintenance } from '@core/bootstrap/runtime-state-maintenance';
import { configureOAuthStrategies } from './modules/auth/services/oauth/config';
import { startTempStorageLifecycle } from './core/bootstrap/start-temp-storage-lifecycle';
import app from './core/config/express';
import { mountClientApp, mountShellBridge, resolveClientDistDir } from './core/config/client-app';
import scriptingJupyterProxyService from './modules/scripting/services/ScriptingJupyterProxyService';
import socketGateway, { SocketGateway } from './modules/socket/socket/SocketGateway';
import { socketModules } from './modules/socket/socket/socket-modules';
import { ClusterTransferRunner } from './modules/cluster/services/transfer/ClusterTransferRunner';
import containerPortRelayLifecycleService, { ContainerPortRelayLifecycleService } from './modules/container/services/ContainerPortRelayLifecycleService';
import containerTerminalSocketModule from './modules/container/socket/ContainerTerminalSocketModule';
import trajectoryCloneRunner, { TrajectoryCloneRunner } from './modules/trajectory/services/trajectory/TrajectoryCloneRunner';
import canvasWorkspaceSocketModule from './modules/trajectory/socket/CanvasWorkspaceSocketModule';
import trajectoryPresenceSocketModule from './modules/trajectory/socket/TrajectoryPresenceSocketModule';
import teamJobsSocketModule from './modules/team/socket/team/TeamJobsSocketModule';
import teamPresenceSocketModule from './modules/team/socket/team-member/TeamPresenceSocketModule';
import whiteboardSocketModule from './modules/whiteboards/socket/WhiteboardSocketModule';
import pluginDebugSocketModule from './modules/plugin/socket/PluginDebugSocketModule';
import teamClusterSocketModule from './modules/cluster/socket/TeamClusterSocketModule';
import analysisLogSocketModule from './modules/analysis/socket/AnalysisLogSocketModule';
import { flushPendingSubscriptions } from './shared/infrastructure/events/event-registry';
import mountEventGroups from './core/bootstrap/mount-event-groups';
import { httpErrorMiddleware } from './shared/infrastructure/http/middleware/error';
import logger from './shared/infrastructure/logger';
import { readNumberEnv } from './shared/infrastructure/utilities/env';
import { writeUpgradeError } from './shared/infrastructure/utilities/proxy-relay';

const SERVER_PORT = readNumberEnv('SERVER_PORT', 8000);
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = readNumberEnv('SERVER_TIMEOUT', 0);
const SERVER_KEEP_ALIVE_TIMEOUT = readNumberEnv('SERVER_KEEP_ALIVE_TIMEOUT', 1800000);
const SERVER_HEADERS_TIMEOUT = readNumberEnv('SERVER_HEADERS_TIMEOUT', SERVER_KEEP_ALIVE_TIMEOUT);
const SERVER_SHUTDOWN_GRACE_PERIOD = readNumberEnv('SERVER_SHUTDOWN_GRACE_PERIOD', 1000);
const SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT = readNumberEnv('SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT', 5000);
const PARENT_WATCH_INTERVAL_MS = 2000;

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

        stopRuntimeStateMaintenance();
        shutdownTasks.push(disconnectDatabase());

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

if (process.env.VOLT_EXIT_WITH_PARENT === '1') {
    const exitWithParent = (): void => {
        setTimeout(() => process.exit(0), SERVER_SHUTDOWN_FORCE_EXIT_TIMEOUT);
        void shutdown();
    };
    process.stdin.resume();
    process.stdin.once('end', exitWithParent);
    process.stdin.once('close', exitWithParent);

    const parentPid = Number(process.env.VOLT_PARENT_PID);
    if (Number.isInteger(parentPid) && parentPid > 0) {
        const parentWatch = setInterval(() => {
            try {
                process.kill(parentPid, 0);
            } catch {
                clearInterval(parentWatch);
                exitWithParent();
            }
        }, PARENT_WATCH_INTERVAL_MS);
    }
}

process.on('unhandledRejection', (reason: unknown) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`@server: unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@server: uncaught exception: ${error.stack || error.message}`);
});

const startServer = async () => {
    registerAIToolControllers(AI_TOOL_CONTROLLERS);

    configureOAuthStrategies();

    await startTempStorageLifecycle();

    const { default: mountHttpRoutes } = await import('./core/bootstrap/mount-http-routes');

    const server = http.createServer(app);
    activeTerminator = createHttpTerminator({
        server,
        gracefulTerminationTimeout: SERVER_SHUTDOWN_GRACE_PERIOD
    });

    app.use(mountHttpRoutes());
    mountShellBridge(app);

    const clientDistDir = resolveClientDistDir();
    if (clientDistDir) {
        mountClientApp(app, clientDistDir);
        logger.info(`@server: serving the web client from ${clientDistDir}`);
    }

    app.use(httpErrorMiddleware);

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT;
    server.headersTimeout = SERVER_HEADERS_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`);
    });

    server.on('upgrade', (request, socket, head) => {
        const requestUrl = request.url ?? '';
        if (requestUrl.startsWith('/socket.io/') || requestUrl.startsWith('/socket.io?')) {
            return;
        }

        if (!scriptingJupyterProxyService.isJupyterUpgradeRequest(request)) {
            socket.destroy();
            return;
        }

        scriptingJupyterProxyService.handleUpgrade(request, socket, head).catch((error: unknown) => {
            logger.error(`@server: jupyter upgrade failed: ${error instanceof Error ? error.message : String(error)}`);
            writeUpgradeError(socket, 500, 'WebSocket upgrade failed');
        });
    });

    server.listen(SERVER_PORT, SERVER_HOST, async () => {
        try {
            const [postgresResult] = await Promise.allSettled([connectDatabase()]);

            const failures: string[] = [];

            if (postgresResult.status === 'rejected') {
                logger.error(`@server: Postgres init failed: ${postgresResult.reason}`);
                failures.push('Postgres');
            }

            if (failures.length > 0) {
                logger.error(`@server: critical dependencies failed (${failures.join(', ')}), shutting down`);
                process.exit(1);
            }

            mountEventGroups();
            await flushPendingSubscriptions();

            startRuntimeStateMaintenance();

            activeSocketGateway = socketGateway;

            activeClusterTransferRunner = new ClusterTransferRunner();
            activeTrajectoryCloneRunner = trajectoryCloneRunner;
            activeContainerPortRelayLifecycle = containerPortRelayLifecycleService;

            for (const module of [
                teamClusterSocketModule,
                canvasWorkspaceSocketModule,
                trajectoryPresenceSocketModule,
                containerTerminalSocketModule,
                teamJobsSocketModule,
                teamPresenceSocketModule,
                whiteboardSocketModule,
                pluginDebugSocketModule,
                analysisLogSocketModule
            ]) {
                activeSocketGateway.register(module);
            }
            for (const module of socketModules) {
                activeSocketGateway.register(module);
            }

            if (activeContainerPortRelayLifecycle) {
                await activeContainerPortRelayLifecycle.start();
            }
            await activeSocketGateway.initialize(server);
            activeClusterTransferRunner?.start();
            activeTrajectoryCloneRunner?.start();
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
