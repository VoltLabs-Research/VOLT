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

// For Bull Redis instance
export const createRedisConnection = () => {
    return new Redis(redisConfig);
};

let redisInstance: Redis | null = null;

export const getRedis = () => {
    if(!redisInstance){
        redisInstance = new Redis(getRedisConfig());
        redisInstance.on('connect', () => {
            console.log('Redis connected successfully');
        });

        redisInstance.on('error', (err) => {
            console.error('Redis connection error:', err);
        });

        redisInstance.on('ready', () => {
            console.log('Redis is ready to accept commands');
        });
    }

    return redisInstance;
};
