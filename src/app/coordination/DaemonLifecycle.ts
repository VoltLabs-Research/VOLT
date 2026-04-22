import type { AwilixContainer } from 'awilix';
import { DaemonConfig } from '@/core/config';
import { Service } from '@/core/decorators/service';
import { CommandRegistry } from '@/core/commands/CommandRegistry';
import { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';
import { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { QueueService } from '@/core/queues/application/QueueService';
import { DebugSessionManager } from '@/modules/analysis/application/workflow/debug/DebugSessionManager';
import { DaemonExposureRegistry } from '@/modules/container/application/access/DaemonExposureRegistry';
import { ObjectGatewayServer } from '@/core/storage/infrastructure/gateway/ObjectGatewayServer';
import { VoltCloudConnection } from '@/modules/container/infrastructure/connection/VoltCloudConnection';
import { ReverseChannelBridge } from '@/modules/container/infrastructure/reverse-channel/ReverseChannelBridge';
import { RuntimeRoleCoordinator } from '@/app/coordination/RuntimeRoleCoordinator';
import { RedisExplorer } from '@/modules/container/infrastructure/remote-access/RedisExplorer';
import { PluginProcessPool } from '@/modules/plugin/application/runtime/PluginProcessPool';
import { logger } from '@/core/logger';
import mongoose from 'mongoose';


@Service('daemonLifecycle')
export class DaemonLifecycle {
    constructor(
        private readonly container: AwilixContainer,
        private readonly config: DaemonConfig,
        private readonly commandRegistry: CommandRegistry,
        private readonly analysisDataStore: AnalysisDataStore,
        private readonly redisConnection: RedisConnection,
        private readonly redisExplorer: RedisExplorer,
        private readonly minioService: MinioService,
        private readonly queueService: QueueService,
        private readonly debugSessionManager: DebugSessionManager,
        private readonly daemonExposureRegistry: DaemonExposureRegistry,
        private readonly objectGatewayServer: ObjectGatewayServer,
        private readonly voltCloudConnection: VoltCloudConnection,
        private readonly reverseChannelBridge: ReverseChannelBridge,
        private readonly runtimeRoleCoordinator: RuntimeRoleCoordinator,
        private readonly pluginProcessPool: PluginProcessPool,
        // Resolving `domainEventBridge` here instantiates the bridge and
        // subscribes all registered domain-event mappers to the dispatcher.
        private readonly domainEventBridge: DomainEventBridge
    ) {
        void this.domainEventBridge;
    }

    private async connectInfrastructure(){
        const mongoConnectionPromise = mongoose.connection.readyState === 1
            ? Promise.resolve()
            : mongoose.connect(this.config.mongodbUri).then(() => undefined);

        await Promise.all([
            this.analysisDataStore.connect(),
            this.redisConnection.connect(),
            this.redisExplorer.connect(),
            mongoConnectionPromise,
            this.minioService.ensureBuckets()
        ]);
    }

    private async disconnectInfrastructure(){
        const mongoDisconnectPromise = mongoose.connection.readyState === 0
            ? Promise.resolve()
            : mongoose.disconnect();

        await Promise.all([
            this.analysisDataStore.disconnect(),
            mongoDisconnectPromise,
            this.redisConnection.disconnect(),
            this.redisExplorer.disconnect()
        ]);
    }

    async start(): Promise<void> {
        await this.startCluster();
    }

    private async startCluster(): Promise<void> {
        logger.info(`Bootstrapping cluster daemon services for teamClusterId=${this.config.teamClusterId}`);

        await this.commandRegistry.registerDecoratedGroups(this.container, this.reverseChannelBridge);

        this.reverseChannelBridge.bindToClient(this.voltCloudConnection);

        await this.connectInfrastructure();

        this.commandRegistry.markReady();

        await Promise.all([
            this.voltCloudConnection.start(),
            this.objectGatewayServer.start()
        ]);

        this.daemonExposureRegistry.upsertDaemonExposure(
            this.objectGatewayServer.getExposure()
        );

        const runtimeConfig = await this.voltCloudConnection.getRuntimeConfig();

        this.daemonExposureRegistry.start();
        await this.runtimeRoleCoordinator.initialize(runtimeConfig);

        logger.info(`cluster-daemon started for team cluster ${this.config.teamClusterId}`);
    }

    async stop(): Promise<void> {
        await this.stopCluster();
    }

    private async stopCluster(): Promise<void> {
        this.debugSessionManager.shutdown();

        await this.runtimeRoleCoordinator.stopComputeWorkers();

        this.daemonExposureRegistry.removeDaemonExposure(
            this.objectGatewayServer.getExposure().id
        );

        this.daemonExposureRegistry.stop();

        await this.objectGatewayServer.stop();

        this.voltCloudConnection.stop();
        await this.queueService.close();
        await this.pluginProcessPool.shutdown();
        await this.disconnectInfrastructure();
    }

}
