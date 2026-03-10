import { createApp } from '../http/createApp';
import { logger } from './logger';
import { registerDaemonDependencies, container } from './container';
import http from 'node:http';

export const bootstrap = async (): Promise<void> => {
    registerDaemonDependencies();

    const config = container.resolve(container.resolve.bind(container) ? Symbol.for('DaemonConfig') : Symbol.for('DaemonConfig'));
    const actualConfig = container.resolve<any>(Symbol.for('DaemonConfig'));
    const eventBroker = container.resolve<any>(Symbol.for('RuntimeEventBroker'));
    const dockerRuntimeService = container.resolve<any>(Symbol.for('DockerRuntimeService'));
    const jupyterRuntimeService = container.resolve<any>(Symbol.for('JupyterRuntimeService'));
    const minioService = container.resolve<any>(Symbol.for('MinioService'));
    const notebookRepository = container.resolve<any>(Symbol.for('NotebookRepository'));
    const pluginListingRepository = container.resolve<any>(Symbol.for('TrajectoryRepository'));
    const queueService = container.resolve<any>(Symbol.for('QueueService'));
    const redisConnectionService = container.resolve<any>(Symbol.for('RedisConnection'));
    const metricsService = container.resolve<any>(Symbol.for('MetricsService'));
    const trajectoryParserService = container.resolve<any>(Symbol.for('TrajectoryParserService'));
    const glbExporterService = container.resolve<any>(Symbol.for('GlbExporterService'));
    const rasterizerService = container.resolve<any>(Symbol.for('RasterizerService'));
    const filterEvaluatorService = container.resolve<any>(Symbol.for('FilterEvaluatorService'));
    const mongoConnectionRepository = container.resolve<any>(Symbol.for('MongoConnection'));
    const analysisWorker = container.resolve<any>(Symbol.for('AnalysisWorker'));
    const sshImportWorkerService = container.resolve<any>(Symbol.for('SSHImportWorkerService'));
    const voltCloudConnection = container.resolve<any>(Symbol.for('VoltCloudConnection'));
    const daemonSocketServer = container.resolve<any>(Symbol.for('DaemonSocketServer'));

    await Promise.all([
        redisConnectionService.connect(),
        mongoConnectionRepository.connect(),
        minioService.ensureBuckets()
    ]);

    eventBroker.emitLifecycle({
        type: 'services-ready',
        teamClusterId: actualConfig.teamClusterId,
        timestamp: new Date().toISOString(),
        connectedToCloud: false,
        details: 'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
    });

    const app = createApp({
        config: actualConfig,
        eventBroker,
        dockerRuntimeService,
        jupyterRuntimeService,
        minioService,
        notebookRepository,
        pluginListingRepository,
        queueService,
        redisConnectionService,
        metricsService,
        trajectoryParserService,
        glbExporterService,
        rasterizerService,
        filterEvaluatorService
    });
    const server = http.createServer(app);

    daemonSocketServer.initialize(server);
    await voltCloudConnection.start();
    analysisWorker.start();
    sshImportWorkerService.start();

    await new Promise<void>((resolve) => {
        server.listen(actualConfig.port, actualConfig.host, () => {
            logger.info(`cluster-daemon listening on http://${actualConfig.host}:${actualConfig.port}`);
            resolve();
        });
    });

    jupyterRuntimeService.initialize().catch((error: unknown) => {
        logger.warn({ err: error }, 'Jupyter runtime image pre-warm failed (will retry on first session request)');
    });

    const shutdown = async () => {
        await analysisWorker.stop();
        await sshImportWorkerService.stop();
        await voltCloudConnection.stop();
        await daemonSocketServer.close();
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
        await queueService.close();
        await Promise.all([
            mongoConnectionRepository.disconnect(),
            redisConnectionService.disconnect()
        ]);
        process.exit(0);
    };

    process.on('SIGINT', () => {
        shutdown().catch(() => process.exit(1));
    });
    process.on('SIGTERM', () => {
        shutdown().catch(() => process.exit(1));
    });
};
