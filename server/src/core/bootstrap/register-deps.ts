import 'reflect-metadata';
import { container } from 'tsyringe';
import { createRedisClient } from '@core/config/redis';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { autoloadModules } from '@shared/infrastructure/bootstrap/autoload';
import RedisEventBus from '@shared/infrastructure/events/RedisEventBus';
import MinioStorageService from '@shared/infrastructure/services/MinioStorageService';

let dependenciesRegistered = false;

/**
 * Registers the infrastructure singletons that can't be declared via class
 * decorators — external-client factories (Redis) and instance-constructed
 * services (MinIO). Everything else self-registers through `@Singleton`,
 * `@CollectionMember`, `@AliasOf`, `@Subscribe`, etc. picked up by
 * `autoloadModules`.
 */
export const registerAllDependencies = async (): Promise<void> => {
    if (dependenciesRegistered) {
        return;
    }

    container.registerInstance(SHARED_TOKENS.RedisClient, createRedisClient());
    container.registerSingleton(SHARED_TOKENS.EventBus, RedisEventBus);
    container.registerInstance(SHARED_TOKENS.StorageService, new MinioStorageService());

    await autoloadModules();

    dependenciesRegistered = true;
};
