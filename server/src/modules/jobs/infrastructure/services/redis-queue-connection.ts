import { createBullMQRedisConnectionOptions } from '@core/config/redis';
import type Redis from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

export const createQueueConnectionFromRedisClient = (redis: Redis): ConnectionOptions => {
    return createBullMQRedisConnectionOptions({
        host: redis.options.host || 'localhost',
        port: redis.options.port || 6379,
        username: redis.options.username,
        password: redis.options.password,
        db: redis.options.db || 0
    });
};
