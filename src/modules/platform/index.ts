import type { DaemonConfig } from '@/core/config';
import { RuntimeEventBroker } from '@/shared/services';
import {
    AnalysisExecutionDataStore,
    connectMongo,
    disconnectMongo,
    DockerRuntimeService,
    MinioService,
    QueueService,
    RedisConnectionService,
    RedisExplorerReadService
} from './services';
import { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory-native/services/TrajectoryAutoPreviewClaimStore';

interface PlatformModule {
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

export const createPlatformModule = (config: DaemonConfig): PlatformModule => {
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
