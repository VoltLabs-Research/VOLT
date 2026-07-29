import Redis from 'ioredis';
import type { RedisConnectionOptions } from '@shared/contracts/types/redis-connection';

export const toRedisConnectionOptions = (
    redis: RedisConnectionOptions,
    options: { keyPrefix?: boolean } = {}
): RedisConnectionOptions => ({
    host: redis.host,
    port: redis.port,
    username: redis.username,
    password: redis.password,
    ...(options.keyPrefix === false ? {} : { keyPrefix: redis.keyPrefix })
});

export const createRedisClient = (connectionOptions: RedisConnectionOptions): Redis => new Redis({
    ...connectionOptions,
    maxRetriesPerRequest: null,
    lazyConnect: true
});
