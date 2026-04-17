import { asValue, createContainer } from 'awilix';
import { InMemoryCommandBus } from '@/core/commands/InMemoryCommandBus';
import { InMemoryEventBus } from '@/core/events/InMemoryEventBus';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { connectMongo, disconnectMongo } from '@/core/storage/infrastructure/mongo/MongoConnectionService';
import { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';
import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { QueueService } from '@/core/queues/application/QueueService';
import { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import { AnalysisExecutionDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore';
import { RedisExplorerReadService } from '@/modules/container/infrastructure/remote-access/RedisExplorerReadService';
import { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';

type BootstrapContainer = ReturnType<typeof createContainer>;

export const registerInfrastructure = (
    container: BootstrapContainer,
    config: import('@/core/config').DaemonConfig
): void => {
    const commandBus = new InMemoryCommandBus();
    const eventBus = new InMemoryEventBus();
    const eventBroker = new RuntimeEventBroker(eventBus);
    const dockerRuntimeService = new DockerRuntimeService(eventBroker);
    const minioService = new MinioService(config);
    const redisConnectionService = new RedisConnectionService(config);
    const analysisExecutionDataStore = new AnalysisExecutionDataStore(config);
    const redisExplorerReadService = new RedisExplorerReadService(config);
    const trajectoryAutoPreviewClaimStore = new TrajectoryAutoPreviewClaimStore(redisConnectionService);
    const queueService = new QueueService(redisConnectionService);

    container.register({
        commandBus: asValue(commandBus),
        eventBus: asValue(eventBus),
        eventBroker: asValue(eventBroker),
        dockerRuntimeService: asValue(dockerRuntimeService),
        minioService: asValue(minioService),
        redisConnectionService: asValue(redisConnectionService),
        analysisExecutionDataStore: asValue(analysisExecutionDataStore),
        redisExplorerReadService: asValue(redisExplorerReadService),
        trajectoryAutoPreviewClaimStore: asValue(trajectoryAutoPreviewClaimStore),
        queueService: asValue(queueService)
    });
};

export const connectDaemonInfrastructure = async (
    config: import('@/core/config').DaemonConfig,
    analysisExecutionDataStore: AnalysisExecutionDataStore,
    redisConnectionService: RedisConnectionService,
    redisExplorerReadService: RedisExplorerReadService,
    minioService: MinioService
): Promise<void> => {
    await Promise.all([
        analysisExecutionDataStore.connect(),
        redisConnectionService.connect(),
        redisExplorerReadService.connect(),
        connectMongo(config.mongodbUri),
        minioService.ensureBuckets()
    ]);
};

export const disconnectDaemonInfrastructure = async (
    analysisExecutionDataStore: AnalysisExecutionDataStore,
    redisConnectionService: RedisConnectionService,
    redisExplorerReadService: RedisExplorerReadService
): Promise<void> => {
    await Promise.all([
        analysisExecutionDataStore.disconnect(),
        disconnectMongo(),
        redisConnectionService.disconnect(),
        redisExplorerReadService.disconnect()
    ]);
};
