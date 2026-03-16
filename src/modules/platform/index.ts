import type { DaemonConfig } from '@/core/config';
import { RuntimeEventBroker } from '@/shared/services';
import { connectMongo, disconnectMongo, DockerRuntimeService, HostShellService, MinioService, QueueService, RedisConnectionService } from './services';

export interface PlatformModule {
    eventBroker: RuntimeEventBroker;
    dockerRuntimeService: DockerRuntimeService;
    hostShellService: HostShellService;
    minioService: MinioService;
    redisConnectionService: RedisConnectionService;
    queueService: QueueService;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
}

export const createPlatformModule = (config: DaemonConfig): PlatformModule => {
    const eventBroker = new RuntimeEventBroker();
    const dockerRuntimeService = new DockerRuntimeService(eventBroker);
    const hostShellService = new HostShellService();
    const minioService = new MinioService(config);
    const redisConnectionService = new RedisConnectionService(config);
    const queueService = new QueueService(redisConnectionService);

    return {
        eventBroker,
        dockerRuntimeService,
        hostShellService,
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
