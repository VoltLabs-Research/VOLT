import { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import { MinioService } from '../infrastructure/minio/MinioService';
import { NotebookRepository } from '../infrastructure/mongo/repositories/NotebookRepository';
import { PluginListingRepository } from '../infrastructure/mongo/repositories/PluginListingRepository';
import { QueueService } from '../infrastructure/redis/QueueService';
import { RedisConnectionService } from '../infrastructure/redis/RedisConnectionService';
import { JupyterRuntimeService } from '../modules/jupyter/JupyterRuntimeService';
import { FilterEvaluatorService } from '../modules/native/FilterEvaluatorService';
import { GlbExporterService } from '../modules/native/GlbExporterService';
import { RasterizerService } from '../modules/native/RasterizerService';
import { TrajectoryParserService } from '../modules/native/TrajectoryParserService';
import type { DaemonConfig } from '../core/config';
import type { ReverseChannelCommandHandler, ReverseChannelSocketBridge } from './ReverseChannelSocketBridge';
import { createAnalysisHandlers } from './handlers/analysis';
import { createJobHandlers } from './handlers/jobs';
import { createTrajectoryHandlers } from './handlers/trajectory';
import { createObjectHandlers } from './handlers/object';
import { createPluginHandlers } from './handlers/plugin';
import { createContainerHandlers } from './handlers/container';
import { createNotebookHandlers } from './handlers/notebook';
import { createRuntimeHandlers } from './handlers/runtime';

interface DaemonCommandRegistryDependencies {
    config: DaemonConfig;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    jupyterRuntimeService: JupyterRuntimeService;
    minioService: MinioService;
    notebookRepository: NotebookRepository;
    pluginListingRepository: PluginListingRepository;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    trajectoryParserService: TrajectoryParserService;
    glbExporterService: GlbExporterService;
    rasterizerService: RasterizerService;
    filterEvaluatorService: FilterEvaluatorService;
};

const collectHandlers = (deps: DaemonCommandRegistryDependencies): ReverseChannelCommandHandler[] => [
    ...createAnalysisHandlers({
        queueService: deps.queueService,
        redisConnectionService: deps.redisConnectionService,
        eventBroker: deps.eventBroker
    }),
    ...createJobHandlers({
        queueService: deps.queueService,
        redisConnectionService: deps.redisConnectionService
    }),
    ...createTrajectoryHandlers({
        minioService: deps.minioService,
        rasterizerService: deps.rasterizerService,
        trajectoryParserService: deps.trajectoryParserService,
        glbExporterService: deps.glbExporterService,
        filterEvaluatorService: deps.filterEvaluatorService
    }),
    ...createObjectHandlers({
        minioService: deps.minioService,
        eventBroker: deps.eventBroker
    }),
    ...createPluginHandlers({
        minioService: deps.minioService,
        eventBroker: deps.eventBroker,
        pluginListingRepository: deps.pluginListingRepository
    }),
    ...createContainerHandlers({
        dockerRuntimeService: deps.dockerRuntimeService
    }),
    ...createNotebookHandlers({
        notebookRepository: deps.notebookRepository,
        jupyterRuntimeService: deps.jupyterRuntimeService
    }),
    ...createRuntimeHandlers({
        config: deps.config,
        eventBroker: deps.eventBroker,
        dockerRuntimeService: deps.dockerRuntimeService
    })
];

export const registerDaemonCommands = (
    bridge: ReverseChannelSocketBridge,
    dependencies: DaemonCommandRegistryDependencies
): void => {
    for (const handler of collectHandlers(dependencies)) {
        bridge.registerHandler(handler);
    }
};
