import { asValue, createContainer } from 'awilix';
import { CommandRegistry } from '@/core/commands/CommandRegistry';
import { EventDispatcher } from '@/core/events/EventDispatcher';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { connectMongo, disconnectMongo } from '@/core/storage/infrastructure/mongo/mongo-connection-service';
import { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';
import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { QueueService } from '@/core/queues/application/QueueService';
import { RedisConnection } from '@/core/storage/infrastructure/redis/RedisConnection';
import { AnalysisDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisDataStore';
import { RedisExplorer } from '@/modules/container/infrastructure/remote-access/RedisExplorer';
import { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerInfrastructure = (
    container: BootstrapContainer,
    config: import('@/core/config').DaemonConfig
): void => {
    const commandRegistry = new CommandRegistry();
    const eventDispatcher = new EventDispatcher();
    const eventBroker = new RuntimeEventBroker(eventDispatcher);
    const dockerRuntime = new DockerRuntime(eventBroker);
    const minioService = new MinioService(config);
    const redisConnection = new RedisConnection(config);
    const analysisDataStore = new AnalysisDataStore(config);
    const redisExplorer = new RedisExplorer(config);
    const trajectoryAutoPreviewClaimStore = new TrajectoryAutoPreviewClaimStore(redisConnection);
    const queueService = new QueueService(redisConnection);

    container.register({
        commandRegistry: asValue(commandRegistry),
        eventDispatcher: asValue(eventDispatcher),
        eventBroker: asValue(eventBroker),
        dockerRuntime: asValue(dockerRuntime),
        minioService: asValue(minioService),
        redisConnection: asValue(redisConnection),
        analysisDataStore: asValue(analysisDataStore),
        redisExplorer: asValue(redisExplorer),
        trajectoryAutoPreviewClaimStore: asValue(trajectoryAutoPreviewClaimStore),
        queueService: asValue(queueService)
    });
};

export const connectDaemonInfrastructure = async (
    config: import('@/core/config').DaemonConfig,
    analysisDataStore: AnalysisDataStore,
    redisConnection: RedisConnection,
    redisExplorer: RedisExplorer,
    minioService: MinioService
): Promise<void> => {
    await Promise.all([
        analysisDataStore.connect(),
        redisConnection.connect(),
        redisExplorer.connect(),
        connectMongo(config.mongodbUri),
        minioService.ensureBuckets()
    ]);
};

export const disconnectDaemonInfrastructure = async (
    analysisDataStore: AnalysisDataStore,
    redisConnection: RedisConnection,
    redisExplorer: RedisExplorer
): Promise<void> => {
    await Promise.all([
        analysisDataStore.disconnect(),
        disconnectMongo(),
        redisConnection.disconnect(),
        redisExplorer.disconnect()
    ]);
};
