import { logger } from './logger';
import { loadConfig } from './config';
import { JupyterRuntimeService } from '../modules/jupyter/services/JupyterRuntimeService';
import { MetricsService } from '../modules/metrics/services/MetricsService';
import { FileExtractorService } from '../modules/ssh-import/services/FileExtractorService';
import { SSHConnectionService } from '../modules/ssh-import/services/SSHConnectionService';
import { SSHImportWorkerService } from '../modules/ssh-import/services/SSHImportWorkerService';
import { createPlatformModule } from '../modules/platform';
import { createTrajectoryNativeModule } from '../modules/trajectory-native';
import { createArtifactsModule } from '../modules/artifacts';
import { createWorkflowRuntimeModule } from '../modules/workflow-runtime';
import { createCloudControlModule } from '../modules/cloud-control';
import { createAnalysisWorker, createJobRuntimeModule } from '../modules/job-runtime';

export const bootstrap = async (): Promise<void> => {
    const config = loadConfig();
    const platform = createPlatformModule(config);
    const metricsService = new MetricsService();
    const trajectoryNative = createTrajectoryNativeModule(platform.minioService);
    const workflowRuntime = createWorkflowRuntimeModule();
    const jupyterRuntimeService = new JupyterRuntimeService(config, platform.dockerRuntimeService);
    const sshConnectionService = new SSHConnectionService();
    const fileExtractorService = new FileExtractorService();
    const sshImportWorkerService = new SSHImportWorkerService(
        config,
        platform.queueService,
        platform.redisConnectionService,
        platform.minioService,
        trajectoryNative.glbExporterService,
        sshConnectionService,
        fileExtractorService
    );
    const bootstrapCloudControl = (
        analysisDispatchService: ReturnType<typeof createJobRuntimeModule>['analysisDispatchService']
    ) => createCloudControlModule({
        config,
        metricsService,
        eventBroker: platform.eventBroker,
        dockerRuntimeService: platform.dockerRuntimeService,
        minioService: platform.minioService,
        queueService: platform.queueService,
        redisConnectionService: platform.redisConnectionService,
        trajectoryParserService: trajectoryNative.trajectoryParserService,
        glbExporterService: trajectoryNative.glbExporterService,
        rasterizerService: trajectoryNative.rasterizerService,
        filterEvaluatorService: trajectoryNative.filterEvaluatorService,
        jupyterRuntimeService,
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
        cloudControl.daemonArtifactReporterService
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
    analysisWorker.start();
    sshImportWorkerService.start();
    logger.info(`cluster-daemon started for team cluster ${config.teamClusterId}`);

    jupyterRuntimeService.initialize().catch((error: unknown) => {
        logger.warn({ err: error }, 'Jupyter runtime image pre-warm failed (will retry on first session request)');
    });

    const shutdown = async () => {
        await analysisWorker.stop();
        await sshImportWorkerService.stop();
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
