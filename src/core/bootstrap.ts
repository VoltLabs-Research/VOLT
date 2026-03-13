import { logger } from './logger';
import { loadConfig } from './config';
import { createJupyterModule } from '@/modules/jupyter';
import { createMetricsModule } from '@/modules/metrics';
import { createSSHImportModule } from '@/modules/ssh-import';
import { createPlatformModule } from '@/modules/platform';
import { createTrajectoryNativeModule } from '@/modules/trajectory-native';
import { createArtifactsModule, createPluginListingRepository } from '@/modules/artifacts';
import { createWorkflowRuntimeModule } from '@/modules/workflow-runtime';
import { createCloudControlModule } from '@/modules/cloud-control';
import { createAnalysisWorker, createJobRuntimeModule } from '@/modules/job-runtime';

export const bootstrap = async (): Promise<void> => {
    const config = loadConfig();
    const platform = createPlatformModule(config);
    const metrics = createMetricsModule();
    const trajectoryNative = createTrajectoryNativeModule(platform.minioService);
    const workflowRuntime = createWorkflowRuntimeModule();
    const jupyter = createJupyterModule(config, platform.dockerRuntimeService);
    const pluginListingRepository = createPluginListingRepository();
    const sshImport = createSSHImportModule({
        config,
        queueService: platform.queueService,
        redisConnectionService: platform.redisConnectionService,
        minioService: platform.minioService,
        glbExporterService: trajectoryNative.glbExporterService
    });
    const bootstrapCloudControl = (
        analysisDispatchService: ReturnType<typeof createJobRuntimeModule>['analysisDispatchService']
    ) => createCloudControlModule({
        config,
        metricsService: metrics.metricsService,
        eventBroker: platform.eventBroker,
        dockerRuntimeService: platform.dockerRuntimeService,
        hostShellService: platform.hostShellService,
        minioService: platform.minioService,
        queueService: platform.queueService,
        redisConnectionService: platform.redisConnectionService,
        trajectoryParserService: trajectoryNative.trajectoryParserService,
        trajectoryPluginParserService: trajectoryNative.trajectoryPluginParserService,
        glbExporterService: trajectoryNative.glbExporterService,
        rasterizerService: trajectoryNative.rasterizerService,
        filterEvaluatorService: trajectoryNative.filterEvaluatorService,
        jupyterRuntimeService: jupyter.jupyterRuntimeService,
        pluginListingRepository,
        analysisDispatchService
    });
    const jobRuntime = createJobRuntimeModule({
        workflowEngine: workflowRuntime.workflowEngine,
        queueService: platform.queueService,
        redisConnectionService: platform.redisConnectionService,
        eventBroker: platform.eventBroker
    });
    const cloudControl = bootstrapCloudControl(jobRuntime.analysisDispatchService);
    const artifacts = createArtifactsModule(
        platform.minioService,
        trajectoryNative.nativeModuleLoader,
        cloudControl.daemonArtifactReporterService,
        pluginListingRepository
    );
    const analysisWorker = createAnalysisWorker({
        queueService: platform.queueService,
        redisConnectionService: platform.redisConnectionService,
        minioService: platform.minioService,
        resultProcessorService: artifacts.resultProcessorService,
        daemonJobReporterService: cloudControl.daemonJobReporterService
    });

    await platform.connect();

    platform.eventBroker.emitLifecycle({
        type: 'services-ready',
        teamClusterId: config.teamClusterId,
        timestamp: new Date().toISOString(),
        connectedToCloud: false,
        details: 'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
    });

    await cloudControl.voltCloudConnection.start();
    cloudControl.daemonExposureRegistryService.start();
    analysisWorker.start();
    sshImport.sshImportWorkerService.start();
    logger.info(`cluster-daemon started for team cluster ${config.teamClusterId}`);

    jupyter.jupyterRuntimeService.initialize().catch((error: unknown) => {
        logger.warn({ err: error }, 'Jupyter runtime image pre-warm failed (will retry on first session request)');
    });

    const shutdown = async () => {
        await analysisWorker.stop();
        await sshImport.sshImportWorkerService.stop();
        cloudControl.daemonExposureRegistryService.stop();
        await cloudControl.voltCloudConnection.stop();
        await platform.queueService.close();
        await platform.disconnect();
        process.exit(0);
    };

    process.on('SIGINT', () => {
        shutdown().catch(() => process.exit(1));
    });
    process.on('SIGTERM', () => {
        shutdown().catch(() => process.exit(1));
    });
};
