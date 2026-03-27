import { logger } from './logger';
import { loadConfig } from './config';
import { startMemoryMonitor, stopMemoryMonitor } from './memory';
import { createJupyterModule } from '@/modules/jupyter';
import { createMetricsModule } from '@/modules/metrics';
import { createSSHImportModule } from '@/modules/ssh-import';
import { createPlatformModule } from '@/modules/platform';
import { QueueConcurrencyCoordinator } from '@/modules/platform/services';
import { createTrajectoryNativeModule } from '@/modules/trajectory-native';
import { TrajectoryRasterWorkerService } from '@/modules/trajectory-native/services';
import { TrajectoryGlbWorkerService } from '@/modules/trajectory-native/services';
import { createArtifactsModule, createPluginListingRepository } from '@/modules/artifacts';
import { createWorkflowRuntimeModule } from '@/modules/workflow-runtime';
import { createCloudControlModule } from '@/modules/cloud-control';
import { RuntimeRoleCoordinator } from '@/modules/cloud-control/services';
import { createAnalysisWorker, createJobRuntimeModule } from '@/modules/job-runtime';
import { OBJECT_GATEWAY_EXPOSURE } from '@/modules/cloud-control/services';
import { createClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import { TeamClusterDirectObjectStoreClient } from '@/shared/storage/TeamClusterDirectObjectStoreClient';
import type { DaemonRuntimeConfig } from './config';

type BootstrapContext = {
    bootStartedAt: number;
    config: ReturnType<typeof loadConfig>;
    runtimeConfig: DaemonRuntimeConfig | null;
    runtimeRoleCoordinator: RuntimeRoleCoordinator;
    platform: ReturnType<typeof createPlatformModule>;
    workflowRuntime: ReturnType<typeof createWorkflowRuntimeModule>;
    cloudControl: ReturnType<typeof createCloudControlModule>;
    sshImport: ReturnType<typeof createSSHImportModule>;
    analysisWorker: ReturnType<typeof createAnalysisWorker>;
    trajectoryRasterWorkerService: TrajectoryRasterWorkerService;
    trajectoryGlbWorkerService: TrajectoryGlbWorkerService;
};

const createBootstrapContext = (): BootstrapContext => {
    const bootStartedAt = Date.now();
    const config = loadConfig();
    const platform = createPlatformModule(config);
    const metrics = createMetricsModule();
    const queueConcurrencyCoordinator = new QueueConcurrencyCoordinator();
    const runtimeRoleCoordinator = new RuntimeRoleCoordinator(queueConcurrencyCoordinator);
    const remoteClient = new TeamClusterDirectObjectStoreClient(config);
    const clusterObjectStore = createClusterObjectStore({
        config,
        minioService: platform.minioService,
        remoteClient,
        getRuntimeSnapshot: () => runtimeRoleCoordinator.getSnapshot()
    });
    const trajectoryNative = createTrajectoryNativeModule(
        clusterObjectStore,
        platform.queueService,
        platform.redisConnectionService
    );
    const workflowRuntime = createWorkflowRuntimeModule();
    const jupyter = createJupyterModule(config, platform.dockerRuntimeService);
    const pluginListingRepository = createPluginListingRepository(clusterObjectStore, config.teamClusterId);
    const jobRuntime = createJobRuntimeModule({
        workflowEngine: workflowRuntime.workflowEngine,
        queueService: platform.queueService,
        analysisExecutionDataStore: platform.analysisExecutionDataStore,
        eventBroker: platform.eventBroker
    });
    const cloudControl = createCloudControlModule({
        config,
        metricsService: metrics.metricsService,
        eventBroker: platform.eventBroker,
        dockerRuntimeService: platform.dockerRuntimeService,
        hostShellService: platform.hostShellService,
        minioService: platform.minioService,
        objectStore: clusterObjectStore,
        queueConcurrencyCoordinator,
        queueService: platform.queueService,
        redisConnectionService: platform.redisConnectionService,
        redisExplorerReadService: platform.redisExplorerReadService,
        trajectoryAutoPreviewClaimStore: platform.trajectoryAutoPreviewClaimStore,
        trajectoryParserService: trajectoryNative.trajectoryParserService,
        trajectoryPluginParserService: trajectoryNative.trajectoryPluginParserService,
        glbExporterService: trajectoryNative.glbExporterService,
        filterEvaluatorService: trajectoryNative.filterEvaluatorService,
        jupyterRuntimeService: jupyter.jupyterRuntimeService,
        pluginListingRepository,
        analysisDispatchService: jobRuntime.analysisDispatchService,
        debugSessionManager: workflowRuntime.debugSessionManager,
        runtimeRoleCoordinator
    });
    const sshImport = createSSHImportModule({
        config,
        queueService: platform.queueService,
        minioService: platform.minioService,
        glbExporterService: trajectoryNative.glbExporterService,
        daemonJobReporterService: cloudControl.daemonJobReporterService,
        voltCloudConnection: cloudControl.voltCloudConnection
    });
    const artifacts = createArtifactsModule(
        clusterObjectStore,
        config.teamClusterId,
        trajectoryNative.nativeModuleLoader,
        cloudControl.daemonArtifactReporterService,
        pluginListingRepository
    );
    const analysisWorker = createAnalysisWorker({
        queueService: platform.queueService,
        analysisExecutionDataStore: platform.analysisExecutionDataStore,
        objectStore: clusterObjectStore,
        resultProcessorService: artifacts.resultProcessorService,
        daemonJobReporterService: cloudControl.daemonJobReporterService
    });
    const trajectoryRasterWorkerService = new TrajectoryRasterWorkerService(
        platform.queueService,
        platform.trajectoryAutoPreviewClaimStore,
        trajectoryNative.rasterizerService,
        cloudControl.daemonJobReporterService
    );
    const trajectoryGlbWorkerService = new TrajectoryGlbWorkerService(
        platform.queueService,
        trajectoryNative.glbExporterService,
        cloudControl.daemonJobReporterService
    );

    queueConcurrencyCoordinator.bind({
        analysisWorker,
        trajectoryRasterWorkerService,
        trajectoryGlbWorkerService,
        sshImportWorkerService: sshImport.sshImportWorkerService
    });
    runtimeRoleCoordinator.bind({
        analysisWorker,
        trajectoryRasterWorkerService,
        trajectoryGlbWorkerService,
        sshImportWorkerService: sshImport.sshImportWorkerService
    });

    return {
        bootStartedAt,
        config,
        runtimeConfig: null,
        runtimeRoleCoordinator,
        platform,
        workflowRuntime,
        cloudControl,
        sshImport,
        analysisWorker,
        trajectoryRasterWorkerService,
        trajectoryGlbWorkerService
    };
};

const loadRuntimeConfig = async (context: BootstrapContext): Promise<DaemonRuntimeConfig> => {
    const runtimeConfig = await context.cloudControl.voltCloudConnection.getRuntimeConfig();
    context.runtimeConfig = runtimeConfig;

    logger.info({
        teamClusterId: context.config.teamClusterId,
        queueConcurrency: runtimeConfig.queueConcurrency
    }, 'Loaded daemon runtime config from Volt');

    return runtimeConfig;
};

const startBootstrapContext = async (context: BootstrapContext): Promise<void> => {
    const {
        bootStartedAt,
        config,
        runtimeRoleCoordinator,
        platform,
        cloudControl
    } = context;

    logger.info({ teamClusterId: config.teamClusterId }, 'Bootstrapping cluster daemon services');

    await platform.connect();
    startMemoryMonitor();

    await cloudControl.voltCloudConnection.start();
    if (config.objectGatewayEnabled) {
        await cloudControl.objectGatewayServer.start();
        cloudControl.daemonExposureRegistryService.upsertDaemonExposure(
            cloudControl.objectGatewayServer.getExposure()
        );
    } else {
        logger.warn({ teamClusterId: config.teamClusterId }, 'Object gateway is disabled by configuration');
    }
    const runtimeConfig = await loadRuntimeConfig(context);
    cloudControl.daemonExposureRegistryService.start();
    await runtimeRoleCoordinator.initialize(runtimeConfig);
    cloudControl.voltCloudConnection.emitLifecycleEvent(
        'services-ready',
        'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
    );
    logger.info(`cluster-daemon started for team cluster ${config.teamClusterId}`);
    logger.info(
        {
            durationMs: Date.now() - bootStartedAt,
            teamClusterId: config.teamClusterId
        },
        'Cluster daemon services ready'
    );
};

const stopBootstrapContext = async (context: BootstrapContext): Promise<void> => {
    stopMemoryMonitor();
    context.workflowRuntime.debugSessionManager.shutdown();
    await context.analysisWorker.stop();
    await context.trajectoryRasterWorkerService.stop();
    await context.trajectoryGlbWorkerService.stop();
    await context.sshImport.sshImportWorkerService.stop();
    if (context.config.objectGatewayEnabled) {
        context.cloudControl.daemonExposureRegistryService.removeDaemonExposure(OBJECT_GATEWAY_EXPOSURE.id);
    }
    context.cloudControl.daemonExposureRegistryService.stop();
    if (context.config.objectGatewayEnabled) {
        await context.cloudControl.objectGatewayServer.stop();
    }
    context.cloudControl.voltCloudConnection.stop();
    await context.platform.queueService.close();
    await context.platform.disconnect();
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
