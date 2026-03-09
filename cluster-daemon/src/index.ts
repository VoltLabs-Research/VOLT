import { loadConfig } from './config/env';
import { RuntimeLifecycleEventType } from './contracts/events';
import { createApp } from './http/createApp';
import { AnalysisWorkerService } from './services/AnalysisWorkerService';
import { DockerRuntimeService } from './services/DockerRuntimeService';
import { JupyterRuntimeService } from './services/JupyterRuntimeService';
import { LocalMinioService } from './services/LocalMinioService';
import { LocalMongoService } from './services/LocalMongoService';
import { LocalRedisService } from './services/LocalRedisService';
import { logger } from './services/logger';
import { MetricsService } from './services/MetricsService';
import { NativeProcessingService } from './services/NativeProcessingService';
import { OrchestrationService } from './services/OrchestrationService';
import { PluginBinaryCacheService } from './services/PluginBinaryCacheService';
import { RuntimeEventBroker } from './services/RuntimeEventBroker';
import { VoltCloudConnection } from './services/VoltCloudConnection';
import { DaemonSocketServer } from './websocket/DaemonSocketServer';
import http from 'node:http';
import path from 'node:path';

const main = async (): Promise<void> => {
    const config = loadConfig();
    const eventBroker = new RuntimeEventBroker();
    const redisService = new LocalRedisService(config);
    const mongoService = new LocalMongoService(config.mongodbUri);
    const minioService = new LocalMinioService(config);
    const dockerRuntimeService = new DockerRuntimeService();
    const jupyterRuntimeService = new JupyterRuntimeService(
        config,
        dockerRuntimeService,
        path.resolve(process.cwd(), 'docker/scripting')
    );
    const metricsService = new MetricsService();
    const nativeProcessingService = new NativeProcessingService(minioService);
    const pluginBinaryCacheService = new PluginBinaryCacheService(minioService);

    let voltCloudConnection: VoltCloudConnection | null = null;

    const reportLifecycle = async (type: RuntimeLifecycleEventType, details?: string): Promise<void> => {
        eventBroker.emitLifecycle({
            type,
            teamClusterId: config.teamClusterId,
            timestamp: new Date().toISOString(),
            connectedToCloud: voltCloudConnection?.isConnectedToCloud() ?? false,
            details
        });

        if (!voltCloudConnection) {
            return;
        }

        if (type === RuntimeLifecycleEventType.UninstallRequested) {
            await voltCloudConnection.reportDeleting(details || 'Remote uninstall requested');
        }

        if (type === RuntimeLifecycleEventType.UninstallCompleted) {
            await voltCloudConnection.reportDeleteCompleted(details || 'Remote uninstall completed');
        }

        if (type === RuntimeLifecycleEventType.UninstallFailed) {
            await voltCloudConnection.reportDeleteFailed(details || 'Remote uninstall failed');
        }

        if (type === RuntimeLifecycleEventType.HeartbeatFailed) {
            await voltCloudConnection.reportDisconnected(details || 'Heartbeat failed');
        }
    };

    const orchestrationService = new OrchestrationService(
        config,
        eventBroker,
        redisService,
        minioService,
        nativeProcessingService,
        dockerRuntimeService,
        reportLifecycle
    );

    voltCloudConnection = new VoltCloudConnection(
        config,
        metricsService,
        eventBroker,
        async () => {
            await orchestrationService.uninstall({
                reason: 'Requested through reverse channel'
            });
        },
        dockerRuntimeService
    );

    const analysisWorkerService = new AnalysisWorkerService(
        config,
        redisService,
        minioService,
        mongoService,
        pluginBinaryCacheService,
        voltCloudConnection
    );

    await Promise.all([
        redisService.connect(),
        mongoService.connect(),
        minioService.ensureBuckets()
    ]);

    eventBroker.emitLifecycle({
        type: RuntimeLifecycleEventType.ServicesReady,
        teamClusterId: config.teamClusterId,
        timestamp: new Date().toISOString(),
        connectedToCloud: false,
        details: 'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
    });

    const app = createApp({
        config,
        eventBroker,
        dockerRuntimeService,
        jupyterRuntimeService,
        minioService,
        mongoService,
        redisService,
        metricsService,
        orchestrationService
    });
    const server = http.createServer(app);
    const socketServer = new DaemonSocketServer({
        config,
        server,
        dockerRuntimeService,
        orchestrationService,
        metricsService,
        eventBroker
    });

    socketServer.initialize();
    await voltCloudConnection.start();
    analysisWorkerService.start();

    server.listen(config.port, config.host, () => {
        logger.info(`cluster-daemon listening on http://${config.host}:${config.port}`);
    });

    jupyterRuntimeService.initialize().catch((error: unknown) => {
        logger.warn({ err: error }, 'Jupyter runtime image pre-warm failed (will retry on first session request)');
    });

    const shutdown = async () => {
        await analysisWorkerService.stop();
        await voltCloudConnection?.stop();
        await socketServer.close();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
        await Promise.all([
            mongoService.disconnect(),
            redisService.disconnect()
        ]);
        process.exit(0);
    };

    process.on('SIGINT', () => {
        void shutdown();
    });
    process.on('SIGTERM', () => {
        void shutdown();
    });
};

main().catch((error: unknown) => {
    logger.error({ err: error }, 'Failed to start cluster daemon');
    process.exit(1);
});
