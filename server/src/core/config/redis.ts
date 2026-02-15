import Redis from 'ioredis';
import logger from '@shared/infrastructure/logger';

const getRedisConfig = () => {
    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        enableReadyCheck: true,
        maxRetriesPerRequest: null
    };

    return redisConfig;
};

// CORE-024: Single factory function for creating Redis connections
export const createRedisConnection = () => {
    return new Redis(getRedisConfig());
};

// Keep createRedisClient as an alias for backwards compatibility
export const createRedisClient = createRedisConnection;

export let redis: Redis | null = null;

export const initializeRedis = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if(redis){
            resolve();
            return;
        }

        redis = new Redis(getRedisConfig());

        redis.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        // CORE-016: Reject the promise on error if not yet resolved
        let settled = false;

        redis.on('error', (err) => {
            logger.error(`Redis connection error: ${err}`);
            if (!settled) {
                settled = true;
                reject(err);
            }
        });

        redis.on('ready', () => {
            logger.info('Redis is ready to accept commands');
            if (!settled) {
                settled = true;
                resolve();
            }
        });

        // CORE-005: Reject on timeout instead of resolving
        setTimeout(() => {
            if(!settled){
                settled = true;
                reject(new Error('Redis initialization timeout - Redis is not ready'));
            }
        }, 5000);
    });
};
