import { loadConfig, type DaemonRuntimeConfig } from '@/core/config';
import { logger } from '@/core/logger';
import { startMemoryMonitor, stopMemoryMonitor } from '@/core/memory';
import { MetricsService } from '@/core/metrics/application/MetricsService';
import { QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { RuntimeCapabilityGuard } from '@/core/runtime/application/RuntimeCapabilityGuard';
import { createBinaryExecutorService } from '@/core/runtime/infrastructure/BinaryExecutorService';
import { createClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import {
    OBJECT_GATEWAY_EXPOSURE,
    ObjectGatewayServer
} from '@/core/storage/infrastructure/gateway/ObjectGatewayServer';
import { TeamClusterDirectObjectStoreClient } from '@/core/storage/infrastructure/object-store/TeamClusterDirectObjectStoreClient';
import { ObjectGatewayTelemetryService } from '@/core/observability/infrastructure/ObjectGatewayTelemetryService';
import { QueueConcurrencyCoordinator } from '@/app/coordination/QueueConcurrencyCoordinator';
import { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';
import { createDaemonInfrastructure, type DaemonInfrastructure } from '@/app/infrastructure';
import { createAnalysisHandlers } from '@/modules/analysis/api/handlers/analysis';
import { createDebugHandlers } from '@/modules/analysis/api/handlers/debug';
import { createDaemonArtifactReporterService } from '@/modules/analysis/application/artifacts/DaemonArtifactReporterService';
import { AnalysisDispatchService } from '@/modules/analysis/application/dispatch/AnalysisDispatchService';
import { AnalysisWorker } from '@/modules/analysis/application/execution/AnalysisWorker';
import { createWorkflowNodeRegistry } from '@/modules/analysis/application/workflow/createWorkflowNodeRegistry';
import { DebugSessionManager } from '@/modules/analysis/application/workflow/debug/DebugSessionManager';
import { WorkflowEngine } from '@/modules/analysis/application/workflow/WorkflowEngine';
import { createContainerHandlers } from '@/modules/container/api/handlers/container';
import { createRemoteAccessHandlers } from '@/modules/container/api/handlers/remote-access';
import { createRuntimeHandlers } from '@/modules/container/api/handlers/runtime';
import { DaemonExposureRegistryService } from '@/modules/container/application/access/DaemonExposureRegistryService';
import { verifyTeamClusterDirectAccessToken } from '@/modules/container/application/access/TeamClusterDirectAccessTokenVerifier';
import { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import { ReverseChannelSocketBridge } from '@/modules/container/infrastructure/reverse-channel/ReverseChannelSocketBridge';
import { createJobHandlers } from '@/modules/jobs/api/handlers/jobs';
import { createDaemonJobReporterService } from '@/modules/jobs/application/reporting/DaemonJobReporterService';
import { createNotebookHandlers } from '@/modules/notebook/api/handlers/notebook';
import { JupyterRuntimeService } from '@/modules/notebook/application/runtime/JupyterRuntimeService';
import { createPluginHandlers } from '@/modules/plugin/api/handlers/plugin';
import { createArtifactUploadQueueService } from '@/modules/plugin/application/artifacts/ArtifactUploadQueueService';
import { ArtifactUploadWorkerService } from '@/modules/plugin/application/artifacts/ArtifactUploadWorkerService';
import { createPluginBinaryCacheService } from '@/modules/plugin/application/binaries/PluginBinaryCacheService';
import { createExportNodeProcessorService } from '@/modules/plugin/application/exports/ExportNodeProcessorService';
import { createResultProcessorService } from '@/modules/plugin/application/exports/ResultProcessorService';
import {
    createPluginListingRepository,
    type PluginListingRepository
} from '@/modules/plugin/infrastructure/repositories/PluginListingRepository';
import { createTrajectoryHandlers } from '@/modules/trajectory/api/handlers/trajectory';
import { createGlbExporterService } from '@/modules/trajectory/application/glb/GlbExporterService';
import { TrajectoryGlbWorkerService } from '@/modules/trajectory/application/glb/TrajectoryGlbWorkerService';
import { SSHImportWorkerService } from '@/modules/trajectory/application/import/SSHImportWorkerService';
import { createTrajectoryParserService } from '@/modules/trajectory/application/parsing/TrajectoryParserService';
import { TrajectoryPluginParserService } from '@/modules/trajectory/application/parsing/TrajectoryPluginParserService';
import { createRasterizerService } from '@/modules/trajectory/application/raster/RasterizerService';
import { TrajectoryRasterWorkerService } from '@/modules/trajectory/application/raster/TrajectoryRasterWorkerService';
import { createFilterEvaluatorService } from '@/modules/trajectory/domain/services/FilterEvaluatorService';
import { FileExtractorService } from '@/modules/trajectory/infrastructure/extraction/FileExtractorService';
import { NativeModuleLoader } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import { SSHConnectionService } from '@/modules/trajectory/infrastructure/ssh/SSHConnectionService';

interface WorkflowRuntimeServices {
    workflowEngine: WorkflowEngine;
    debugSessionManager: DebugSessionManager;
}

interface AnalysisRuntimeServices extends WorkflowRuntimeServices {
    analysisDispatchService: AnalysisDispatchService;
    analysisWorker: AnalysisWorker;
}

interface PluginRuntimeServices {
    pluginListingRepository: PluginListingRepository;
    artifactUploadQueueService: ReturnType<typeof createArtifactUploadQueueService>;
    artifactUploadWorkerService: ArtifactUploadWorkerService;
    pluginBinaryCacheService: ReturnType<typeof createPluginBinaryCacheService>;
    resultProcessorService: ReturnType<typeof createResultProcessorService>;
}

interface TrajectoryRuntimeServices {
    nativeModuleLoader: NativeModuleLoader;
    trajectoryParserService: ReturnType<typeof createTrajectoryParserService>;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    rasterizerService: ReturnType<typeof createRasterizerService>;
    glbExporterService: ReturnType<typeof createGlbExporterService>;
    filterEvaluatorService: ReturnType<typeof createFilterEvaluatorService>;
    sshImportWorkerService: SSHImportWorkerService;
    trajectoryRasterWorkerService: TrajectoryRasterWorkerService;
    trajectoryGlbWorkerService: TrajectoryGlbWorkerService;
}

interface ControlPlaneServices {
    reverseChannelSocketBridge: ReverseChannelSocketBridge;
    voltCloudConnection: VoltCloudConnection;
    daemonExposureRegistryService: DaemonExposureRegistryService;
    objectGatewayServer: ObjectGatewayServer;
    daemonArtifactReporterService: ReturnType<typeof createDaemonArtifactReporterService>;
    daemonJobReporterService: ReturnType<typeof createDaemonJobReporterService>;
}

interface BootstrapContext {
    bootStartedAt: number;
    config: ReturnType<typeof loadConfig>;
    runtimeConfig: DaemonRuntimeConfig | null;
    infrastructure: DaemonInfrastructure;
    runtimeRoleCoordinator: RuntimeRoleCoordinator;
    analysis: AnalysisRuntimeServices;
    plugin: PluginRuntimeServices;
    trajectory: TrajectoryRuntimeServices;
    controlPlane: ControlPlaneServices;
}

const createBootstrapContext = (): BootstrapContext => {
    const bootStartedAt = Date.now();
    const config = loadConfig();
    const infrastructure = createDaemonInfrastructure(config);
    const metricsService = new MetricsService();
    const queueConcurrencyCoordinator = new QueueConcurrencyCoordinator();
    const queueScopeLimitsRegistry = new QueueScopeLimitsRegistry();
    const runtimeRoleCoordinator = new RuntimeRoleCoordinator(
        queueConcurrencyCoordinator,
        queueScopeLimitsRegistry
    );

    const remoteClient = new TeamClusterDirectObjectStoreClient(config);
    const objectStore = createClusterObjectStore({
        config,
        minioService: infrastructure.minioService,
        remoteClient,
        getRuntimeSnapshot: () => runtimeRoleCoordinator.getSnapshot()
    });

    const nativeModuleLoader = new NativeModuleLoader();
    const trajectoryParserService = createTrajectoryParserService(objectStore, nativeModuleLoader);
    const trajectoryPluginParserService = new TrajectoryPluginParserService(objectStore);
    const rasterizerService = createRasterizerService(objectStore, nativeModuleLoader);
    const glbExporterService = createGlbExporterService(
        objectStore,
        nativeModuleLoader,
        trajectoryParserService,
        infrastructure.queueService,
        infrastructure.redisConnectionService
    );
    const filterEvaluatorService = createFilterEvaluatorService(
        objectStore,
        nativeModuleLoader,
        trajectoryParserService,
        trajectoryPluginParserService
    );

    const pluginBinaryCacheService = createPluginBinaryCacheService(objectStore);
    const pluginListingRepository = createPluginListingRepository(objectStore, config.teamClusterId);
    const artifactUploadQueueService = createArtifactUploadQueueService(infrastructure.queueService);
    const exportNodeProcessorService = createExportNodeProcessorService(nativeModuleLoader);
    const resultProcessorService = createResultProcessorService(
        pluginListingRepository,
        exportNodeProcessorService
    );

    const binaryExecutorService = createBinaryExecutorService();
    const workflowNodeRegistry = createWorkflowNodeRegistry();
    const workflowEngine = new WorkflowEngine(workflowNodeRegistry);
    const debugSessionManager = new DebugSessionManager(workflowNodeRegistry, {
        objectStore,
        pluginBinaryCacheService,
        binaryExecutorService,
        nativeModuleLoader
    });
    const analysisDispatchService = new AnalysisDispatchService(
        workflowEngine,
        infrastructure.queueService,
        infrastructure.analysisExecutionDataStore,
        infrastructure.eventBroker
    );

    const jupyterRuntimeService = new JupyterRuntimeService(config, infrastructure.dockerRuntimeService);
    const runtimeCapabilityGuard = new RuntimeCapabilityGuard(runtimeRoleCoordinator);
    const objectGatewayTelemetryService = new ObjectGatewayTelemetryService();
    const reverseChannelSocketBridge = new ReverseChannelSocketBridge(
        infrastructure.dockerRuntimeService,
        objectGatewayTelemetryService
    );
    const voltCloudConnection = new VoltCloudConnection(
        config,
        metricsService,
        infrastructure.eventBroker,
        () => runtimeRoleCoordinator.getSnapshot()
    );
    const daemonArtifactReporterService = createDaemonArtifactReporterService(voltCloudConnection);
    const daemonJobReporterService = createDaemonJobReporterService(voltCloudConnection);

    const artifactUploadWorkerService = new ArtifactUploadWorkerService(
        infrastructure.queueService,
        infrastructure.redisConnectionService,
        queueScopeLimitsRegistry,
        objectStore,
        daemonArtifactReporterService,
        daemonJobReporterService
    );
    const analysisWorker = new AnalysisWorker(
        infrastructure.queueService,
        infrastructure.redisConnectionService,
        queueScopeLimitsRegistry,
        infrastructure.analysisExecutionDataStore,
        objectStore,
        pluginBinaryCacheService,
        binaryExecutorService,
        artifactUploadQueueService,
        resultProcessorService,
        daemonJobReporterService
    );
    const sshImportWorkerService = new SSHImportWorkerService(
        config,
        infrastructure.queueService,
        infrastructure.minioService,
        glbExporterService,
        daemonJobReporterService,
        voltCloudConnection,
        new SSHConnectionService(),
        new FileExtractorService()
    );
    const trajectoryRasterWorkerService = new TrajectoryRasterWorkerService(
        infrastructure.queueService,
        infrastructure.trajectoryAutoPreviewClaimStore,
        rasterizerService,
        daemonJobReporterService
    );
    const trajectoryGlbWorkerService = new TrajectoryGlbWorkerService(
        infrastructure.queueService,
        infrastructure.redisConnectionService,
        queueScopeLimitsRegistry,
        glbExporterService,
        daemonJobReporterService
    );

    const handlers = [
        ...createAnalysisHandlers({
            analysisDispatchService,
            runtimeCapabilityGuard
        }),
        ...createDebugHandlers({ debugSessionManager }),
        ...createJobHandlers({
            queueService: infrastructure.queueService,
            redisConnectionService: infrastructure.redisConnectionService
        }),
        ...createTrajectoryHandlers({
            objectStore,
            queueService: infrastructure.queueService,
            trajectoryAutoPreviewClaimStore: infrastructure.trajectoryAutoPreviewClaimStore,
            trajectoryParserService,
            trajectoryPluginParserService,
            glbExporterService,
            filterEvaluatorService,
            runtimeCapabilityGuard
        }),
        ...createPluginHandlers({
            objectStore,
            pluginListingRepository,
            runtimeCapabilityGuard
        }),
        ...createContainerHandlers({ dockerRuntimeService: infrastructure.dockerRuntimeService }),
        ...createRemoteAccessHandlers({
            minioService: infrastructure.minioService,
            redisExplorerReadService: infrastructure.redisExplorerReadService
        }),
        ...createNotebookHandlers({ jupyterRuntimeService }),
        ...createRuntimeHandlers({
            config,
            dockerRuntimeService: infrastructure.dockerRuntimeService,
            emitLifecycle: (type, details) => {
                voltCloudConnection.emitLifecycleEvent(type, details);
            },
            applyQueueSettings: (queueConcurrency, queueScopeLimits) => {
                runtimeRoleCoordinator.applyQueueSettings(queueConcurrency, queueScopeLimits);
            },
            applyRoleConfig: (roleConfig) => runtimeRoleCoordinator.applyRoleConfig(roleConfig),
            reportDeleteFailed: (details) => voltCloudConnection.reportDeleteFailed(details)
        })
    ];

    for (const handler of handlers) {
        reverseChannelSocketBridge.registerHandler(handler);
    }

    reverseChannelSocketBridge.bindToClient(voltCloudConnection);

    const daemonExposureRegistryService = new DaemonExposureRegistryService(
        config,
        infrastructure.dockerRuntimeService,
        voltCloudConnection
    );
    const objectGatewayServer = new ObjectGatewayServer(
        config,
        infrastructure.minioService,
        objectGatewayTelemetryService,
        {
            capabilityGuard: runtimeCapabilityGuard,
            verifyDirectAccessToken: (token) => verifyTeamClusterDirectAccessToken(config.daemonPassword, token)
        }
    );
    reverseChannelSocketBridge.setExposureRegistryService(daemonExposureRegistryService);

    debugSessionManager.setExecutionLogReporter(daemonJobReporterService);

    queueConcurrencyCoordinator.bind({
        analysisWorker,
        trajectoryRasterWorkerService,
        trajectoryGlbWorkerService,
        sshImportWorkerService
    });
    runtimeRoleCoordinator.bind({
        analysisWorker,
        artifactUploadWorkerService,
        trajectoryRasterWorkerService,
        trajectoryGlbWorkerService,
        sshImportWorkerService
    });

    return {
        bootStartedAt,
        config,
        runtimeConfig: null,
        infrastructure,
        runtimeRoleCoordinator,
        analysis: {
            workflowEngine,
            debugSessionManager,
            analysisDispatchService,
            analysisWorker
        },
        plugin: {
            pluginListingRepository,
            artifactUploadQueueService,
            artifactUploadWorkerService,
            pluginBinaryCacheService,
            resultProcessorService
        },
        trajectory: {
            nativeModuleLoader,
            trajectoryParserService,
            trajectoryPluginParserService,
            rasterizerService,
            glbExporterService,
            filterEvaluatorService,
            sshImportWorkerService,
            trajectoryRasterWorkerService,
            trajectoryGlbWorkerService
        },
        controlPlane: {
            reverseChannelSocketBridge,
            voltCloudConnection,
            daemonExposureRegistryService,
            objectGatewayServer,
            daemonArtifactReporterService,
            daemonJobReporterService
        }
    };
};

const loadRuntimeConfig = async (context: BootstrapContext): Promise<DaemonRuntimeConfig> => {
    const runtimeConfig = await context.controlPlane.voltCloudConnection.getRuntimeConfig();
    context.runtimeConfig = runtimeConfig;

    logger.info({
        teamClusterId: context.config.teamClusterId,
        queueConcurrency: runtimeConfig.queueConcurrency
    }, 'Loaded daemon runtime config from Volt');

    return runtimeConfig;
};

const startBootstrapContext = async (context: BootstrapContext): Promise<void> => {
    logger.info({ teamClusterId: context.config.teamClusterId }, 'Bootstrapping cluster daemon services');

    await context.infrastructure.connect();
    startMemoryMonitor();

    await context.controlPlane.voltCloudConnection.start();
    if (context.config.objectGatewayEnabled) {
        await context.controlPlane.objectGatewayServer.start();
        context.controlPlane.daemonExposureRegistryService.upsertDaemonExposure(
            context.controlPlane.objectGatewayServer.getExposure()
        );
    } else {
        logger.warn({ teamClusterId: context.config.teamClusterId }, 'Object gateway is disabled by configuration');
    }

    const runtimeConfig = await loadRuntimeConfig(context);
    context.controlPlane.daemonExposureRegistryService.start();
    await context.runtimeRoleCoordinator.initialize(runtimeConfig);
    context.controlPlane.voltCloudConnection.emitLifecycleEvent(
        'services-ready',
        'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
    );

    logger.info(`cluster-daemon started for team cluster ${context.config.teamClusterId}`);
    logger.info({
        durationMs: Date.now() - context.bootStartedAt,
        teamClusterId: context.config.teamClusterId
    }, 'Cluster daemon services ready');
};

const stopBootstrapContext = async (context: BootstrapContext): Promise<void> => {
    stopMemoryMonitor();
    context.analysis.debugSessionManager.shutdown();
    await context.analysis.analysisWorker.stop();
    await context.plugin.artifactUploadWorkerService.stop();
    await context.trajectory.trajectoryRasterWorkerService.stop();
    await context.trajectory.trajectoryGlbWorkerService.stop();
    await context.trajectory.sshImportWorkerService.stop();

    if (context.config.objectGatewayEnabled) {
        context.controlPlane.daemonExposureRegistryService.removeDaemonExposure(OBJECT_GATEWAY_EXPOSURE.id);
    }
    context.controlPlane.daemonExposureRegistryService.stop();
    if (context.config.objectGatewayEnabled) {
        await context.controlPlane.objectGatewayServer.stop();
    }
    context.controlPlane.voltCloudConnection.stop();
    await context.infrastructure.queueService.close();
    await context.infrastructure.disconnect();
};

const registerShutdownHandlers = (shutdown: () => Promise<void>): void => {
    const handleShutdown = (): void => {
        shutdown()
            .then(() => process.exit(0))
            .catch(() => process.exit(1));
    };

    process.on('SIGINT', handleShutdown);
    process.on('SIGTERM', handleShutdown);
};

export const bootstrap = async (): Promise<void> => {
    const context = createBootstrapContext();

    await startBootstrapContext(context);
    registerShutdownHandlers(() => stopBootstrapContext(context));
};
