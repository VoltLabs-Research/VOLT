import { notebookRepository } from '../jupyter/repositories';
import { pluginListingRepository } from '../artifacts/repositories';
import type { DaemonConfig } from '../../core/config';
import type { RuntimeEventBroker } from '../../shared/services';
import type { DockerRuntimeService, MinioService, QueueService, RedisConnectionService } from '../platform/services';
import type { AnalysisDispatchService } from '../job-runtime/services';
import { createDaemonArtifactReporterService, createDaemonJobReporterService, ReverseChannelSocketBridge, VoltCloudConnection, type DaemonArtifactReporterService, type DaemonJobReporterService } from './services';
import type { JupyterRuntimeService } from '../jupyter/services';
import type { MetricsService } from '../metrics/services';
import type { FilterEvaluatorService, GlbExporterService, RasterizerService, TrajectoryParserService } from '../trajectory-native/services';
import {
    createAnalysisHandlers,
    createJobHandlers,
    createTrajectoryHandlers,
    createObjectHandlers,
    createPluginHandlers,
    createContainerHandlers,
    createNotebookHandlers,
    createRuntimeHandlers
} from './handlers';

export interface CloudControlModule {
    reverseChannelSocketBridge: ReverseChannelSocketBridge;
    voltCloudConnection: VoltCloudConnection;
    daemonArtifactReporterService: DaemonArtifactReporterService;
    daemonJobReporterService: DaemonJobReporterService;
}

export const createCloudControlModule = (deps: {
    config: DaemonConfig;
    metricsService: MetricsService;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    minioService: MinioService;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    trajectoryParserService: TrajectoryParserService;
    glbExporterService: GlbExporterService;
    rasterizerService: RasterizerService;
    filterEvaluatorService: FilterEvaluatorService;
    jupyterRuntimeService: JupyterRuntimeService;
    analysisDispatchService: AnalysisDispatchService;
}): CloudControlModule => {
    const reverseChannelSocketBridge = new ReverseChannelSocketBridge(deps.config, deps.dockerRuntimeService);
    const handlers = [
        ...createAnalysisHandlers({ analysisDispatchService: deps.analysisDispatchService }),
        ...createJobHandlers({ queueService: deps.queueService, redisConnectionService: deps.redisConnectionService }),
        ...createTrajectoryHandlers({
            minioService: deps.minioService,
            rasterizerService: deps.rasterizerService,
            trajectoryParserService: deps.trajectoryParserService,
            glbExporterService: deps.glbExporterService,
            filterEvaluatorService: deps.filterEvaluatorService
        }),
        ...createObjectHandlers({ minioService: deps.minioService, eventBroker: deps.eventBroker }),
        ...createPluginHandlers({
            minioService: deps.minioService,
            eventBroker: deps.eventBroker,
            pluginListingRepository
        }),
        ...createContainerHandlers({ dockerRuntimeService: deps.dockerRuntimeService }),
        ...createNotebookHandlers({ notebookRepository, jupyterRuntimeService: deps.jupyterRuntimeService }),
        ...createRuntimeHandlers({ config: deps.config, eventBroker: deps.eventBroker, dockerRuntimeService: deps.dockerRuntimeService })
    ];

    for (const handler of handlers) {
        reverseChannelSocketBridge.registerHandler(handler);
    }

    const voltCloudConnection = new VoltCloudConnection(
        deps.config,
        deps.metricsService,
        deps.eventBroker,
        reverseChannelSocketBridge
    );

    return {
        reverseChannelSocketBridge,
        voltCloudConnection,
        daemonArtifactReporterService: createDaemonArtifactReporterService(voltCloudConnection),
        daemonJobReporterService: createDaemonJobReporterService(voltCloudConnection)
    };
};
