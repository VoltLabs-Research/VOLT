import type { Redis } from 'ioredis';
import redisClient from '@shared/infrastructure/redis/redisClient';
import eventBus from '@shared/infrastructure/events/RedisEventBus';

const isRedisHandle = (value: unknown): value is Redis => {
    return typeof value === 'object'
        && value !== null
        && typeof (value as Redis).disconnect === 'function'
        && typeof (value as Redis).status === 'string';
};

export const closeRedisHandles = (): void => {
    const candidates: unknown[] = [
        redisClient,
        ...Object.values(eventBus as unknown as Record<string, unknown>)
    ];

    for(const candidate of candidates){
        if(isRedisHandle(candidate)) candidate.disconnect();
    }
};
