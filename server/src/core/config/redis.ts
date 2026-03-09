import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import logger from '@shared/infrastructure/logger';
import Redis from 'ioredis';
import type { ConnectionOptions } from 'bullmq';

export interface RedisClientConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
};

export const getRedisConfig = (): RedisClientConfig => {
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: readNumberEnv('REDIS_PORT', 6379),
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        db: readNumberEnv('REDIS_DB', 0)
    };
};

export const createRedisClientConfig = (config: RedisClientConfig): RedisClientConfig => {
    return {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        db: config.db ?? 0
    };
};

export const createBullMQRedisConnectionOptions = (config: RedisClientConfig): ConnectionOptions => {
    return {
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        db: config.db ?? 0,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null
    };
};

export let redis: Redis | null = null;

export const initializeRedis = (): Promise<void> => {
    return new Promise((resolve) => {
        if(redis){
            resolve();
            return;
        }

        redis = new Redis(createRedisClientConfig(getRedisConfig()));

        redis.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        redis.on('error', (err) => {
            logger.error(`Redis connection error: ${err}`);
        });

        redis.on('ready', () => {
            logger.info('Redis is ready to accept commands');
            resolve();
        });

        // Add a timeout in case Redis never becomes ready
        setTimeout(() => {
            if(redis?.status !== 'ready'){
                logger.warn('Redis initialization timeout - continuing anyway');
                resolve();
            }
        }, 5000);
    });
};

export const createRedisClient = () => {
    return new Redis(createRedisClientConfig(getRedisConfig()));
};
