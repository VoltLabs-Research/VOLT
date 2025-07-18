import Redis from 'ioredis';

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

export const initializeRedis = () => {
    if(redis) return;
    redis = new Redis(getRedisConfig());

    redis.on('connect', () => {
        console.log('Redis connected successfully');
    });

    redis.on('error', (err) => {
        console.error('Redis connection error:', err);
    });

    redis.on('ready', () => {
        console.log('Redis is ready to accept commands');
    });
}