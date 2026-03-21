import type { PluginListingRepository } from '@/modules/artifacts';
import type { DaemonConfig } from '@/core/config';
import type { RuntimeEventBroker } from '@/shared/services';
import type {
    DockerRuntimeService,
    HostShellService,
    MinioService,
    QueueConcurrencyCoordinator,
    QueueService,
    RedisConnectionService,
    RedisExplorerReadService
} from '@/modules/platform/services';
import type { AnalysisDispatchService } from '@/modules/job-runtime/services';
import type { DebugSessionManager } from '@/modules/workflow-runtime/services';
import {
    createDaemonArtifactReporterService,
    createDaemonJobReporterService,
    DaemonExposureRegistryService,
    ReverseChannelSocketBridge,
    VoltCloudConnection,
    type DaemonArtifactReporterService,
    type DaemonJobReporterService
} from './services';
import type { JupyterRuntimeService } from '@/modules/jupyter/services';
import type { MetricsService } from '@/modules/metrics/services';
import type { 
    FilterEvaluatorService, 
    GlbExporterService, 
    TrajectoryParserService,
    TrajectoryAutoPreviewClaimStore,
    TrajectoryPluginParserService
} from '@/modules/trajectory-native/services';
import {
    createAnalysisHandlers,
    createDebugHandlers,
    createJobHandlers,
    createTrajectoryHandlers,
    createObjectHandlers,
    createPluginHandlers,
    createContainerHandlers,
    createNotebookHandlers,
    createRemoteAccessHandlers,
    createRuntimeHandlers
} from './handlers';

export interface CloudControlModule {
    reverseChannelSocketBridge: ReverseChannelSocketBridge;
    voltCloudConnection: VoltCloudConnection;
    daemonExposureRegistryService: DaemonExposureRegistryService;
    daemonArtifactReporterService: DaemonArtifactReporterService;
    daemonJobReporterService: DaemonJobReporterService;
}

export const createCloudControlModule = (deps: {
    config: DaemonConfig;
    metricsService: MetricsService;
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    hostShellService: HostShellService;
    minioService: MinioService;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    redisExplorerReadService: RedisExplorerReadService;
    queueConcurrencyCoordinator: QueueConcurrencyCoordinator;
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
    jupyterRuntimeService: JupyterRuntimeService;
    pluginListingRepository: PluginListingRepository;
    analysisDispatchService: AnalysisDispatchService;
    debugSessionManager: DebugSessionManager;
}): CloudControlModule => {
    const reverseChannelSocketBridge = new ReverseChannelSocketBridge(
        deps.dockerRuntimeService,
        deps.hostShellService
    );
    const voltCloudConnection = new VoltCloudConnection(
        deps.config,
        deps.metricsService,
        deps.eventBroker
    );

    const handlers = [
        ...createAnalysisHandlers({ analysisDispatchService: deps.analysisDispatchService }),
        ...createDebugHandlers({ debugSessionManager: deps.debugSessionManager }),
        ...createJobHandlers({ queueService: deps.queueService, redisConnectionService: deps.redisConnectionService }),
        ...createTrajectoryHandlers({
            minioService: deps.minioService,
            queueService: deps.queueService,
            redisConnectionService: deps.redisConnectionService,
            trajectoryAutoPreviewClaimStore: deps.trajectoryAutoPreviewClaimStore,
            trajectoryParserService: deps.trajectoryParserService,
            trajectoryPluginParserService: deps.trajectoryPluginParserService,
            glbExporterService: deps.glbExporterService,
            filterEvaluatorService: deps.filterEvaluatorService
        }),
        ...createObjectHandlers({ minioService: deps.minioService, eventBroker: deps.eventBroker }),
        ...createPluginHandlers({
            minioService: deps.minioService,
            eventBroker: deps.eventBroker,
            pluginListingRepository: deps.pluginListingRepository
        }),
        ...createContainerHandlers({ dockerRuntimeService: deps.dockerRuntimeService }),
        ...createRemoteAccessHandlers({
            minioService: deps.minioService,
            redisExplorerReadService: deps.redisExplorerReadService
        }),
        ...createNotebookHandlers({ jupyterRuntimeService: deps.jupyterRuntimeService }),
        ...createRuntimeHandlers({
            config: deps.config,
            dockerRuntimeService: deps.dockerRuntimeService,
            hostShellService: deps.hostShellService,
            emitLifecycle: (type, details) => {
                voltCloudConnection.emitLifecycleEvent(type, details);
            },
            applyQueueConcurrency: (queueConcurrency) => deps.queueConcurrencyCoordinator.apply(queueConcurrency),
            reportUpdateFailed: (details) => voltCloudConnection.reportUpdateFailed(details),
            reportDeleteFailed: (details) => voltCloudConnection.reportDeleteFailed(details)
        })
    ];

    for (const handler of handlers) {
        reverseChannelSocketBridge.registerHandler(handler);
    }

    // Bind the bridge to the client after both objects are created.
    reverseChannelSocketBridge.bindToClient(voltCloudConnection);

    const daemonExposureRegistryService = new DaemonExposureRegistryService(
        deps.config,
        deps.dockerRuntimeService,
        voltCloudConnection
    );
    reverseChannelSocketBridge.setExposureRegistryService(daemonExposureRegistryService);

    return {
        reverseChannelSocketBridge,
        voltCloudConnection,
        daemonExposureRegistryService,
        daemonArtifactReporterService: createDaemonArtifactReporterService(voltCloudConnection),
        daemonJobReporterService: createDaemonJobReporterService(voltCloudConnection)
    };
};
