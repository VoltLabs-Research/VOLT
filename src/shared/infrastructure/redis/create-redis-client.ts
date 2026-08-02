import Redis from 'ioredis';
import type { RedisConnectionOptions } from '@shared/contracts/types/redis-connection';

export const createRedisClient = (connectionOptions: RedisConnectionOptions): Redis => new Redis({
    ...connectionOptions,
    maxRetriesPerRequest: null,
    lazyConnect: true
});
