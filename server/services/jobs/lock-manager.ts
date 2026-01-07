import IORedis from 'ioredis';
import { createRedisClient } from '@/config/redis';

class LockManager {
    private redis: IORedis;

    constructor() {
        this.redis = createRedisClient();
    }

    async acquire(lockKey: string, ttlMs = 60000): Promise<boolean> {
        const result = await this.redis.set(lockKey, `${process.pid}:${Date.now()}`, 'PX', ttlMs, 'NX');
        return result === 'OK';
    }

    async release(lockKey: string): Promise<void> {
        await this.redis.del(lockKey);
    }

    async withLock<T>(lockKey: string, fn: () => Promise<T>, ttlMs = 60000): Promise<T | null> {
        if (!(await this.acquire(lockKey, ttlMs))) return null;
        try {
            return await fn();
        } finally {
            await this.release(lockKey);
        }
    }
}

export const lockManager = new LockManager();
