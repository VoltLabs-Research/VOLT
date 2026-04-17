import type { AwilixContainer } from 'awilix';
import { registerDaemonCommands } from '@/app/bootstrap/commands';
import { registerDaemonEventSubscribers } from '@/app/bootstrap/events';
import { logger } from '@/core/logger';
import { startMemoryMonitor, stopMemoryMonitor } from '@/core/memory';
import { connectDaemonInfrastructure, disconnectDaemonInfrastructure } from '@/app/infrastructure';

export class DaemonLifecycle {
    constructor(
        private readonly container: AwilixContainer,
        private readonly config: import('@/core/config').DaemonConfig,
        private readonly bootStartedAt: number,
        private readonly eventBus: import('@/core/events/InMemoryEventBus').InMemoryEventBus,
        private readonly commandBus: import('@/core/commands/InMemoryCommandBus').InMemoryCommandBus,
        private readonly analysisExecutionDataStore: import('@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore').AnalysisExecutionDataStore,
        private readonly redisConnectionService: import('@/core/storage/infrastructure/redis/RedisConnectionService').RedisConnectionService,
        private readonly redisExplorerReadService: import('@/modules/container/infrastructure/remote-access/RedisExplorerReadService').RedisExplorerReadService,
        private readonly minioService: import('@/core/storage/infrastructure/minio/MinioService').MinioService,
        private readonly queueService: import('@/core/queues/application/QueueService').QueueService,
        private readonly debugSessionManager: import('@/modules/analysis/application/workflow/debug/DebugSessionManager').DebugSessionManager,
        private readonly analysisWorker: import('@/modules/analysis/application/execution/AnalysisWorker').AnalysisWorker,
        private readonly artifactUploadWorkerService: import('@/modules/plugin/application/artifacts/ArtifactUploadWorkerService').ArtifactUploadWorkerService,
        private readonly trajectoryRasterWorkerService: import('@/modules/trajectory/application/raster/TrajectoryRasterWorkerService').TrajectoryRasterWorkerService,
        private readonly trajectoryGlbWorkerService: import('@/modules/trajectory/application/glb/TrajectoryGlbWorkerService').TrajectoryGlbWorkerService,
        private readonly sshImportWorkerService: import('@/modules/trajectory/application/import/SSHImportWorkerService').SSHImportWorkerService,
        private readonly daemonExposureRegistryService: import('@/modules/container/application/access/DaemonExposureRegistryService').DaemonExposureRegistryService,
        private readonly objectGatewayServer: import('@/core/storage/infrastructure/gateway/ObjectGatewayServer').ObjectGatewayServer,
        private readonly voltCloudConnection: import('@/modules/container/infrastructure/connection/VoltCloudConnection').VoltCloudConnection,
        private readonly reverseChannelSocketBridge: import('@/modules/container/infrastructure/reverse-channel/ReverseChannelSocketBridge').ReverseChannelSocketBridge,
        private readonly runtimeRoleCoordinator: import('@/app/coordination/RuntimeRoleCoordinator').RuntimeRoleCoordinator
    ) {}

    async start(): Promise<void> {
        logger.info({ teamClusterId: this.config.teamClusterId }, 'Bootstrapping cluster daemon services');

        await registerDaemonEventSubscribers(this.container, this.eventBus);
        await registerDaemonCommands(
            this.container,
            this.commandBus,
            this.reverseChannelSocketBridge
        );

        this.reverseChannelSocketBridge.bindToClient(this.voltCloudConnection);

        await connectDaemonInfrastructure(
            this.config,
            this.analysisExecutionDataStore,
            this.redisConnectionService,
            this.redisExplorerReadService,
            this.minioService
        );

        startMemoryMonitor();
        await this.voltCloudConnection.start();

        if (this.config.objectGatewayEnabled) {
            await this.objectGatewayServer.start();
            this.daemonExposureRegistryService.upsertDaemonExposure(
                this.objectGatewayServer.getExposure()
            );
        } else {
            logger.warn({ teamClusterId: this.config.teamClusterId }, 'Object gateway is disabled by configuration');
        }

        const runtimeConfig = await this.voltCloudConnection.getRuntimeConfig();

        logger.info(
            {
                teamClusterId: this.config.teamClusterId,
                queueConcurrency: runtimeConfig.queueConcurrency
            },
            'Loaded daemon runtime config from Volt'
        );

        this.daemonExposureRegistryService.start();
        await this.runtimeRoleCoordinator.initialize(runtimeConfig);
        this.voltCloudConnection.emitLifecycleEvent(
            'services-ready',
            'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
        );

        logger.info(`cluster-daemon started for team cluster ${this.config.teamClusterId}`);
        logger.info(
            {
                durationMs: Date.now() - this.bootStartedAt,
                teamClusterId: this.config.teamClusterId
            },
            'Cluster daemon services ready'
        );
    }

    async stop(): Promise<void> {
        stopMemoryMonitor();
        this.debugSessionManager.shutdown();
        await this.analysisWorker.stop();
        await this.artifactUploadWorkerService.stop();
        await this.trajectoryRasterWorkerService.stop();
        await this.trajectoryGlbWorkerService.stop();
        await this.sshImportWorkerService.stop();

        if (this.config.objectGatewayEnabled) {
            this.daemonExposureRegistryService.removeDaemonExposure(
                this.objectGatewayServer.getExposure().id
            );
        }

        this.daemonExposureRegistryService.stop();

        if (this.config.objectGatewayEnabled) {
            await this.objectGatewayServer.stop();
        }

        this.voltCloudConnection.stop();
        await this.queueService.close();
        await disconnectDaemonInfrastructure(
            this.analysisExecutionDataStore,
            this.redisConnectionService,
            this.redisExplorerReadService
        );
    }
}
