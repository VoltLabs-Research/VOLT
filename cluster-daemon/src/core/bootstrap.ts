import { RuntimeLifecycleEventType } from '../contracts/events';
import { DAEMON_TOKENS } from './tokens';
import { logger } from './logger';
import { registerDaemonDependencies, container } from './container';
import type { DaemonConfig } from './config';
import type { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import type { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import type { MinioService } from '../infrastructure/minio/MinioService';
import type { MongoConnectionRepository } from '../infrastructure/mongo/repositories/MongoConnectionRepository';
import type { NotebookRepository } from '../infrastructure/mongo/repositories/NotebookRepository';
import type { PluginListingRepository } from '../infrastructure/mongo/repositories/PluginListingRepository';
import type { QueueService } from '../infrastructure/redis/QueueService';
import type { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import type { AnalysisWorker } from '../modules/analysis/AnalysisWorker';
import type { JupyterRuntimeService } from '../modules/jupyter/JupyterRuntimeService';
import type { MetricsService } from '../modules/metrics/MetricsService';
import type { FilterEvaluatorService } from '../modules/native/FilterEvaluatorService';
import type { GlbExporterService } from '../modules/native/GlbExporterService';
import type { RasterizerService } from '../modules/native/RasterizerService';
import type { TrajectoryParserService } from '../modules/native/TrajectoryParserService';
import type { SSHImportWorkerService } from '../modules/ssh-import/SSHImportWorkerService';
import type { VoltCloudConnection } from '../websocket/VoltCloudConnection';

export const bootstrap = async (): Promise<void> => {
    registerDaemonDependencies();

    const config = container.resolve<DaemonConfig>(DAEMON_TOKENS.Config);
    const eventBroker = container.resolve<RuntimeEventBroker>(DAEMON_TOKENS.RuntimeEventBroker);
    const dockerRuntimeService = container.resolve<DockerRuntimeService>(DAEMON_TOKENS.DockerRuntimeService);
    const jupyterRuntimeService = container.resolve<JupyterRuntimeService>(DAEMON_TOKENS.JupyterRuntimeService);
    const minioService = container.resolve<MinioService>(DAEMON_TOKENS.MinioService);
    const notebookRepository = container.resolve<NotebookRepository>(DAEMON_TOKENS.NotebookRepository);
    const pluginListingRepository = container.resolve<PluginListingRepository>(DAEMON_TOKENS.TrajectoryRepository);
    const queueService = container.resolve<QueueService>(DAEMON_TOKENS.QueueService);
    const redisConnectionService = container.resolve<RedisConnectionService>(DAEMON_TOKENS.RedisConnection);
    const metricsService = container.resolve<MetricsService>(DAEMON_TOKENS.MetricsService);
    const trajectoryParserService = container.resolve<TrajectoryParserService>(DAEMON_TOKENS.TrajectoryParserService);
    const glbExporterService = container.resolve<GlbExporterService>(DAEMON_TOKENS.GlbExporterService);
    const rasterizerService = container.resolve<RasterizerService>(DAEMON_TOKENS.RasterizerService);
    const filterEvaluatorService = container.resolve<FilterEvaluatorService>(DAEMON_TOKENS.FilterEvaluatorService);
    const mongoConnectionRepository = container.resolve<MongoConnectionRepository>(DAEMON_TOKENS.MongoConnection);
    const analysisWorker = container.resolve<AnalysisWorker>(DAEMON_TOKENS.AnalysisWorker);
    const sshImportWorkerService = container.resolve<SSHImportWorkerService>(DAEMON_TOKENS.SSHImportWorkerService);
    const voltCloudConnection = container.resolve<VoltCloudConnection>(DAEMON_TOKENS.VoltCloudConnection);

    await Promise.all([
        redisConnectionService.connect(),
        mongoConnectionRepository.connect(),
        minioService.ensureBuckets()
    ]);

    eventBroker.emitLifecycle({
        type: RuntimeLifecycleEventType.ServicesReady,
        teamClusterId: config.teamClusterId,
        timestamp: new Date().toISOString(),
        connectedToCloud: false,
        details: 'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
    });

    await voltCloudConnection.start();
    analysisWorker.start();
    sshImportWorkerService.start();
    logger.info(`cluster-daemon started for team cluster ${config.teamClusterId}`);

    jupyterRuntimeService.initialize().catch((error: unknown) => {
        logger.warn({ err: error }, 'Jupyter runtime image pre-warm failed (will retry on first session request)');
    });

    const shutdown = async () => {
        await analysisWorker.stop();
        await sshImportWorkerService.stop();
        await voltCloudConnection.stop();
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
