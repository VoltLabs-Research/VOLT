import { logger } from './logger';
import { loadConfig } from './config';
import { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import { MinioService } from '../infrastructure/minio/MinioService';
import { MongoConnectionRepository } from '../infrastructure/mongo/repositories/MongoConnectionRepository';
import { NotebookRepository } from '../infrastructure/mongo/repositories/NotebookRepository';
import { PluginListingRepository } from '../infrastructure/mongo/repositories/PluginListingRepository';
import { SceneArtifactRepository } from '../infrastructure/mongo/repositories/SceneArtifactRepository';
import { QueueService } from '../infrastructure/redis/QueueService';
import { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import { AnalysisWorker } from '../modules/analysis/AnalysisWorker';
import { BinaryExecutorService } from '../modules/analysis/BinaryExecutorService';
import { ExportNodeProcessorService } from '../modules/analysis/ExportNodeProcessorService';
import { PluginBinaryCacheService } from '../modules/analysis/PluginBinaryCacheService';
import { ResultProcessorService } from '../modules/analysis/ResultProcessorService';
import { JupyterRuntimeService } from '../modules/jupyter/JupyterRuntimeService';
import { MetricsService } from '../modules/metrics/MetricsService';
import { FilterEvaluatorService } from '../modules/native/FilterEvaluatorService';
import { GlbExporterService } from '../modules/native/GlbExporterService';
import { NativeModuleLoader } from '../modules/native/NativeModuleLoader';
import { RasterizerService } from '../modules/native/RasterizerService';
import { TrajectoryParserService } from '../modules/native/TrajectoryParserService';
import { FileExtractorService } from '../modules/ssh-import/FileExtractorService';
import { SSHConnectionService } from '../modules/ssh-import/SSHConnectionService';
import { SSHImportWorkerService } from '../modules/ssh-import/SSHImportWorkerService';
import { VoltCloudConnection } from '../websocket/VoltCloudConnection';

export const bootstrap = async (): Promise<void> => {
    const config = loadConfig();
    const eventBroker = new RuntimeEventBroker();
    const dockerRuntimeService = new DockerRuntimeService();
    const minioService = new MinioService(config);
    const mongoConnectionRepository = new MongoConnectionRepository(config);
    const notebookRepository = new NotebookRepository();
    const pluginListingRepository = new PluginListingRepository();
    const sceneArtifactRepository = new SceneArtifactRepository();
    const redisConnectionService = new RedisConnectionService(config);
    const queueService = new QueueService(redisConnectionService);
    const metricsService = new MetricsService();
    const nativeModuleLoader = new NativeModuleLoader();
    const trajectoryParserService = new TrajectoryParserService(minioService, nativeModuleLoader);
    const rasterizerService = new RasterizerService(minioService, nativeModuleLoader);
    const glbExporterService = new GlbExporterService(
        minioService,
        nativeModuleLoader,
        trajectoryParserService,
        rasterizerService
    );
    const filterEvaluatorService = new FilterEvaluatorService(minioService, nativeModuleLoader, trajectoryParserService);
    const jupyterRuntimeService = new JupyterRuntimeService(config, dockerRuntimeService);
    const pluginBinaryCacheService = new PluginBinaryCacheService(minioService);
    const binaryExecutorService = new BinaryExecutorService(redisConnectionService);
    const exportNodeProcessorService = new ExportNodeProcessorService(
        minioService,
        nativeModuleLoader,
        sceneArtifactRepository
    );
    const resultProcessorService = new ResultProcessorService(
        minioService,
        pluginListingRepository,
        exportNodeProcessorService
    );
    const analysisWorker = new AnalysisWorker(
        queueService,
        redisConnectionService,
        minioService,
        pluginBinaryCacheService,
        binaryExecutorService,
        resultProcessorService
    );
    const sshConnectionService = new SSHConnectionService();
    const fileExtractorService = new FileExtractorService();
    const sshImportWorkerService = new SSHImportWorkerService(
        config,
        queueService,
        redisConnectionService,
        minioService,
        glbExporterService,
        sshConnectionService,
        fileExtractorService
    );
    const voltCloudConnection = new VoltCloudConnection(
        config,
        metricsService,
        eventBroker,
        dockerRuntimeService,
        minioService,
        notebookRepository,
        pluginListingRepository,
        queueService,
        redisConnectionService,
        trajectoryParserService,
        glbExporterService,
        rasterizerService,
        filterEvaluatorService,
        jupyterRuntimeService
    );

    await Promise.all([
        redisConnectionService.connect(),
        mongoConnectionRepository.connect(),
        minioService.ensureBuckets()
    ]);

    eventBroker.emitLifecycle({
        type: 'services-ready',
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
