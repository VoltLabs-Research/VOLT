import type { DaemonConfig } from '@/core/config';
import { RuntimeEventBroker } from '@/core/reverse-channel/application/RuntimeEventBroker';
import { connectMongo, disconnectMongo } from '@/core/storage/infrastructure/mongo/MongoConnectionService';
import { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';
import { MinioService } from '@/core/storage/infrastructure/minio/MinioService';
import { QueueService } from '@/core/queues/application/QueueService';
import { RedisConnectionService } from '@/core/storage/infrastructure/redis/RedisConnectionService';
import { AnalysisExecutionDataStore } from '@/modules/analysis/infrastructure/storage/AnalysisExecutionDataStore';
import { RedisExplorerReadService } from '@/modules/container/infrastructure/remote-access/RedisExplorerReadService';
import { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';

export interface DaemonInfrastructure {
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    minioService: MinioService;
    redisConnectionService: RedisConnectionService;
    analysisExecutionDataStore: AnalysisExecutionDataStore;
    redisExplorerReadService: RedisExplorerReadService;
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore;
    queueService: QueueService;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
}

export const createDaemonInfrastructure = (config: DaemonConfig): DaemonInfrastructure => {
    const eventBroker = new RuntimeEventBroker();
    const dockerRuntimeService = new DockerRuntimeService(eventBroker);
    const minioService = new MinioService(config);
    const redisConnectionService = new RedisConnectionService(config);
    const analysisExecutionDataStore = new AnalysisExecutionDataStore(config);
    const redisExplorerReadService = new RedisExplorerReadService(config);
    const trajectoryAutoPreviewClaimStore = new TrajectoryAutoPreviewClaimStore(redisConnectionService);
    const queueService = new QueueService(redisConnectionService);

    return {
        eventBroker,
        dockerRuntimeService,
        minioService,
        redisConnectionService,
        analysisExecutionDataStore,
        redisExplorerReadService,
        trajectoryAutoPreviewClaimStore,
        queueService,
        async connect() {
            await Promise.all([
                analysisExecutionDataStore.connect(),
                redisConnectionService.connect(),
                redisExplorerReadService.connect(),
                connectMongo(config.mongodbUri),
                minioService.ensureBuckets()
            ]);
        },
        async disconnect() {
            await Promise.all([
                analysisExecutionDataStore.disconnect(),
                disconnectMongo(),
                redisConnectionService.disconnect(),
                redisExplorerReadService.disconnect()
            ]);
        }
    };
};
