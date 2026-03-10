import { createDaemonAuthMiddleware } from './middleware/authenticate';
import { createContainersRouter } from './routes/containers';
import { createHealthRouter } from './routes/health';
import { createMetricsRouter } from './routes/metrics';
import { createNativeRouter } from './routes/native';
import { createNotebooksRouter } from './routes/notebooks';
import { createObjectsRouter } from './routes/objects';
import express from 'express';
import type { DaemonConfig } from '../core/config';
import type { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import type { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import type { MinioService } from '../infrastructure/minio/MinioService';
import type { NotebookRepository } from '../infrastructure/mongo/repositories/NotebookRepository';
import type { PluginListingRepository } from '../infrastructure/mongo/repositories/PluginListingRepository';
import type { QueueService } from '../infrastructure/redis/QueueService';
import type { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import type { JupyterRuntimeService } from '../modules/jupyter/JupyterRuntimeService';
import type { MetricsService } from '../modules/metrics/MetricsService';
import type { FilterEvaluatorService } from '../modules/native/FilterEvaluatorService';
import type { GlbExporterService } from '../modules/native/GlbExporterService';
import type { RasterizerService } from '../modules/native/RasterizerService';
import type { TrajectoryParserService } from '../modules/native/TrajectoryParserService';

interface CreateAppDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    jupyterRuntimeService: JupyterRuntimeService;
    minioService: MinioService;
    notebookRepository: NotebookRepository;
    pluginListingRepository: PluginListingRepository;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    metricsService: MetricsService;
    trajectoryParserService: TrajectoryParserService;
    glbExporterService: GlbExporterService;
    rasterizerService: RasterizerService;
    filterEvaluatorService: FilterEvaluatorService;
};

export const createApp = (dependencies: CreateAppDependencies) => {
    const app = express();
    app.use(express.json({ limit: '50mb' }));

    app.use(createHealthRouter(dependencies.metricsService, dependencies.eventBroker));
    app.use(createDaemonAuthMiddleware(dependencies.config.daemonPassword));
    app.use(createMetricsRouter(dependencies.metricsService));
    app.use(createContainersRouter(dependencies.dockerRuntimeService));
    app.use(createNotebooksRouter(dependencies.notebookRepository, dependencies.jupyterRuntimeService));
    app.use(createObjectsRouter({
        config: dependencies.config,
        eventBroker: dependencies.eventBroker,
        minioService: dependencies.minioService,
        pluginListingRepository: dependencies.pluginListingRepository,
        notebookRepository: dependencies.notebookRepository,
        queueService: dependencies.queueService,
        redisConnectionService: dependencies.redisConnectionService,
        rasterizerService: dependencies.rasterizerService,
        dockerRuntimeService: dependencies.dockerRuntimeService
    }));
    app.use(createNativeRouter(
        dependencies.eventBroker,
        dependencies.glbExporterService,
        dependencies.trajectoryParserService,
        dependencies.filterEvaluatorService
    ));

    return app;
};
