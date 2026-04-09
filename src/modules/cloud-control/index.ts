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
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import {
    createDaemonArtifactReporterService,
    createDaemonJobReporterService,
    DaemonExposureRegistryService,
    ObjectGatewayServer,
    ObjectGatewayTelemetryService,
    ReverseChannelSocketBridge,
    RuntimeCapabilityGuard,
    RuntimeRoleCoordinator,
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
    objectGatewayServer: ObjectGatewayServer;
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
    objectStore: ClusterObjectStore;
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
    runtimeRoleCoordinator: RuntimeRoleCoordinator;
}): CloudControlModule => {
    const objectGatewayTelemetryService = new ObjectGatewayTelemetryService();
    const reverseChannelSocketBridge = new ReverseChannelSocketBridge(
        deps.dockerRuntimeService,
        deps.hostShellService,
        objectGatewayTelemetryService
    );
    const runtimeCapabilityGuard = new RuntimeCapabilityGuard(deps.runtimeRoleCoordinator);
    const voltCloudConnection = new VoltCloudConnection(
        deps.config,
        deps.metricsService,
        deps.eventBroker,
        () => deps.runtimeRoleCoordinator.getSnapshot()
    );

    const handlers = [
        ...createAnalysisHandlers({
            analysisDispatchService: deps.analysisDispatchService,
            runtimeCapabilityGuard
        }),
        ...createDebugHandlers({ debugSessionManager: deps.debugSessionManager }),
        ...createJobHandlers({ queueService: deps.queueService, redisConnectionService: deps.redisConnectionService }),
        ...createTrajectoryHandlers({
            objectStore: deps.objectStore,
            queueService: deps.queueService,
            redisConnectionService: deps.redisConnectionService,
            trajectoryAutoPreviewClaimStore: deps.trajectoryAutoPreviewClaimStore,
            trajectoryParserService: deps.trajectoryParserService,
            trajectoryPluginParserService: deps.trajectoryPluginParserService,
            glbExporterService: deps.glbExporterService,
            filterEvaluatorService: deps.filterEvaluatorService,
            runtimeCapabilityGuard
        }),
        ...createPluginHandlers({
            objectStore: deps.objectStore,
            eventBroker: deps.eventBroker,
            pluginListingRepository: deps.pluginListingRepository,
            runtimeCapabilityGuard
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
            applyQueueSettings: (queueConcurrency, queueScopeLimits) => {
                deps.runtimeRoleCoordinator.applyQueueSettings(queueConcurrency, queueScopeLimits);
            },
            applyRoleConfig: (roleConfig) => deps.runtimeRoleCoordinator.applyRoleConfig(roleConfig),
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
    const objectGatewayServer = new ObjectGatewayServer(
        deps.config,
        deps.minioService,
        objectGatewayTelemetryService,
        runtimeCapabilityGuard
    );
    reverseChannelSocketBridge.setExposureRegistryService(daemonExposureRegistryService);

    return {
        reverseChannelSocketBridge,
        voltCloudConnection,
        daemonExposureRegistryService,
        objectGatewayServer,
        daemonArtifactReporterService: createDaemonArtifactReporterService(voltCloudConnection),
        daemonJobReporterService: createDaemonJobReporterService(voltCloudConnection)
    };
};
