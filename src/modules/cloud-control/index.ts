import type { PluginListingRepository } from '@/modules/artifacts';
import type { DaemonConfig } from '@/core/config';
import type { RuntimeEventBroker } from '@/shared/services';
import type { DockerRuntimeService, HostShellService, MinioService, QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { AnalysisDispatchService } from '@/modules/job-runtime/services';
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
    RasterizerService, 
    TrajectoryParserService,
    TrajectoryPluginParserService
} from '@/modules/trajectory-native/services';
import {
    createAnalysisHandlers,
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
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    glbExporterService: GlbExporterService;
    rasterizerService: RasterizerService;
    filterEvaluatorService: FilterEvaluatorService;
    jupyterRuntimeService: JupyterRuntimeService;
    pluginListingRepository: PluginListingRepository;
    analysisDispatchService: AnalysisDispatchService;
}): CloudControlModule => {
    const reverseChannelSocketBridge = new ReverseChannelSocketBridge(
        deps.dockerRuntimeService,
        deps.hostShellService
    );

    // Lazy reference resolved after voltCloudConnection is constructed below.
    let voltCloudConnectionRef: VoltCloudConnection | null = null;

    const handlers = [
        ...createAnalysisHandlers({ analysisDispatchService: deps.analysisDispatchService }),
        ...createJobHandlers({ queueService: deps.queueService, redisConnectionService: deps.redisConnectionService }),
        ...createTrajectoryHandlers({
            minioService: deps.minioService,
            rasterizerService: deps.rasterizerService,
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
            redisConnectionService: deps.redisConnectionService
        }),
        ...createNotebookHandlers({ jupyterRuntimeService: deps.jupyterRuntimeService }),
        ...createRuntimeHandlers({
            config: deps.config,
            eventBroker: deps.eventBroker,
            dockerRuntimeService: deps.dockerRuntimeService,
            hostShellService: deps.hostShellService,
            reportUpdateFailed: (details) => voltCloudConnectionRef?.reportUpdateFailed(details) ?? Promise.resolve()
        })
    ];

    for (const handler of handlers) {
        reverseChannelSocketBridge.registerHandler(handler);
    }

    const voltCloudConnection = new VoltCloudConnection(
        deps.config,
        deps.metricsService,
        deps.eventBroker
    );
    voltCloudConnectionRef = voltCloudConnection;

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
