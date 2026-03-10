import type { DaemonConfig } from '../../core/config';
import { RuntimeEventBroker } from '../../shared/services';
import { DockerRuntimeService, MinioService, QueueService, RedisConnectionService } from './services';
import { connectMongo, disconnectMongo } from './repositories';

export interface PlatformModule {
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    minioService: MinioService;
    redisConnectionService: RedisConnectionService;
    queueService: QueueService;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
}

export const createPlatformModule = (config: DaemonConfig): PlatformModule => {
    const eventBroker = new RuntimeEventBroker();
    const dockerRuntimeService = new DockerRuntimeService();
    const minioService = new MinioService(config);
    const redisConnectionService = new RedisConnectionService(config);
    const queueService = new QueueService(redisConnectionService);

    return {
        eventBroker,
        dockerRuntimeService,
        minioService,
        redisConnectionService,
        queueService,
        async connect() {
            await Promise.all([
                redisConnectionService.connect(),
                connectMongo(config.mongodbUri),
                minioService.ensureBuckets()
            ]);
        },
        async disconnect() {
            await Promise.all([
                disconnectMongo(),
                redisConnectionService.disconnect()
            ]);
        }
    };
};
