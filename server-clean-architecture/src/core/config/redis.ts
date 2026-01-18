import Redis from 'ioredis';
import logger from '@shared/infrastructure/logger';

const getRedisConfig = () => {
    const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0'),
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null
    };

    return redisConfig;
};

export const createRedisConnection = () => {
    return new Redis(getRedisConfig());
};

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
    return new Redis(getRedisConfig());
};
