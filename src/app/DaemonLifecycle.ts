import type { AwilixContainer } from 'awilix';
import { logger } from '@/core/logger';
import { connectDaemonInfrastructure, disconnectDaemonInfrastructure } from '@/app/infrastructure';

export class DaemonLifecycle {
    constructor(
        private readonly container: AwilixContainer,
        private readonly config: import('@/core/config').DaemonConfig,
        private readonly bootStartedAt: number,
        private readonly eventDispatcher: import('@/core/events/EventDispatcher').EventDispatcher,
        private readonly commandRegistry: import('@/core/commands/CommandRegistry').CommandRegistry,
        private readonly analysisDataStore: import('@/modules/analysis/infrastructure/storage/AnalysisDataStore').AnalysisDataStore,
        private readonly redisConnection: import('@/core/storage/infrastructure/redis/RedisConnection').RedisConnection,
        private readonly redisExplorer: import('@/modules/container/infrastructure/remote-access/RedisExplorer').RedisExplorer,
        private readonly minioService: import('@/core/storage/infrastructure/minio/MinioService').MinioService,
        private readonly queueService: import('@/core/queues/application/QueueService').QueueService,
        private readonly debugSessionManager: import('@/modules/analysis/application/workflow/debug/DebugSessionManager').DebugSessionManager,
        private readonly analysisWorker: import('@/modules/analysis/application/workers/AnalysisWorker').AnalysisWorker,
        private readonly artifactUploadWorker: import('@/modules/plugin/application/artifacts/ArtifactUploadWorker').ArtifactUploadWorker,
        private readonly trajectoryRasterWorker: import('@/modules/trajectory/application/raster/TrajectoryRasterWorker').TrajectoryRasterWorker,
        private readonly trajectoryGlbWorker: import('@/modules/trajectory/application/glb/TrajectoryGlbWorker').TrajectoryGlbWorker,
        private readonly sshImportWorker: import('@/modules/trajectory/application/import/SSHImportWorker').SSHImportWorker,
        private readonly daemonExposureRegistry: import('@/modules/container/application/access/DaemonExposureRegistry').DaemonExposureRegistry,
        private readonly objectGatewayServer: import('@/core/storage/infrastructure/gateway/ObjectGatewayServer').ObjectGatewayServer,
        private readonly voltCloudConnection: import('@/modules/container/infrastructure/connection/VoltCloudConnection').VoltCloudConnection,
        private readonly reverseChannelBridge: import('@/modules/container/infrastructure/reverse-channel/ReverseChannelBridge').ReverseChannelBridge,
        private readonly runtimeRoleCoordinator: import('@/app/coordination/RuntimeRoleCoordinator').RuntimeRoleCoordinator
    ) {}

    async start(): Promise<void> {
        logger.info(`Bootstrapping cluster daemon services for teamClusterId=${this.config.teamClusterId}`);

        await this.eventDispatcher.registerDecoratedGroups(this.container);
        await this.commandRegistry.registerDecoratedGroups(this.container, this.reverseChannelBridge);

        this.reverseChannelBridge.bindToClient(this.voltCloudConnection);

        await connectDaemonInfrastructure(
            this.config,
            this.analysisDataStore,
            this.redisConnection,
            this.redisExplorer,
            this.minioService
        );

        await this.voltCloudConnection.start();

        if (this.config.objectGatewayEnabled) {
            await this.objectGatewayServer.start();
            this.daemonExposureRegistry.upsertDaemonExposure(
                this.objectGatewayServer.getExposure()
            );
        } else {
            logger.warn(`Object gateway is disabled by configuration for teamClusterId=${this.config.teamClusterId}`);
        }

        const runtimeConfig = await this.voltCloudConnection.getRuntimeConfig();

        logger.info(`Loaded daemon runtime config from Volt for teamClusterId=${this.config.teamClusterId}: queueConcurrency analysis=${runtimeConfig.queueConcurrency.analysis}, rasterizer=${runtimeConfig.queueConcurrency.rasterizer}, glbPreprocessing=${runtimeConfig.queueConcurrency.glbPreprocessing}, sshImport=${runtimeConfig.queueConcurrency.sshImport}`);

        this.daemonExposureRegistry.start();
        await this.runtimeRoleCoordinator.initialize(runtimeConfig);
        this.voltCloudConnection.emitLifecycleEvent(
            'services-ready',
            'Cluster-local Redis, MongoDB, MinIO, and Docker coordination ready'
        );

        logger.info(`cluster-daemon started for team cluster ${this.config.teamClusterId}`);
    }

    async stop(): Promise<void> {
        this.debugSessionManager.shutdown();
        await this.analysisWorker.stop();
        await this.artifactUploadWorker.stop();
        await this.trajectoryRasterWorker.stop();
        await this.trajectoryGlbWorker.stop();
        await this.sshImportWorker.stop();

        if (this.config.objectGatewayEnabled) {
            this.daemonExposureRegistry.removeDaemonExposure(
                this.objectGatewayServer.getExposure().id
            );
        }

        this.daemonExposureRegistry.stop();

        if (this.config.objectGatewayEnabled) {
            await this.objectGatewayServer.stop();
        }

        this.voltCloudConnection.stop();
        await this.queueService.close();
        await disconnectDaemonInfrastructure(
            this.analysisDataStore,
            this.redisConnection,
            this.redisExplorer
        );
    }
}
