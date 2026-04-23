import { Singleton } from '@shared/infrastructure/di/decorators';
import mongoose from 'mongoose';

import { redis } from '@core/config/redis';
import type { ResponseTimes } from '@modules/system/domain/value-objects/SystemMetrics';

const HEALTH_CHECK_CACHE_TTL_MS = 5_000;

@Singleton()
export default class ServiceHealthPinger {
    private cachedResponseTimes: {
        expiresAt: number;
        value: ResponseTimes;
    } | null = null;
    private pendingCollection: Promise<ResponseTimes> | null = null;

    private async pingMongoose(): Promise<number> {
        try {
            const start = Date.now();
            await mongoose.connection.db?.admin().ping();
            return Date.now() - start;
        } catch {
            return 0;
        }
    }

    private async pingMinIO(): Promise<number> {
        try {
            const { getMinioClient } = await import('@core/config/minio');
            const client = getMinioClient();
            const start = Date.now();
            await client.listBuckets();
            return Date.now() - start;
        } catch {
            return 0;
        }
    }

    private async pingRedis(): Promise<number> {
        try {
            if (!redis) return 0;
            const start = Date.now();
            await redis.ping();
            return Date.now() - start;
        } catch {
            return 0;
        }
    }

    async collectAll(): Promise<ResponseTimes> {
        const cachedResponseTimes = this.cachedResponseTimes;
        if (cachedResponseTimes && cachedResponseTimes.expiresAt > Date.now()) {
            return cachedResponseTimes.value;
        }

        if (this.pendingCollection) {
            return this.pendingCollection;
        }

        this.pendingCollection = Promise.all([
            this.pingMongoose(),
            this.pingRedis(),
            this.pingMinIO()
        ])
            .then(([mongooseLatency, redisLatency, minioLatency]) => {
                const responseTimes: ResponseTimes = {
                    mongodb: mongooseLatency,
                    redis: redisLatency,
                    minio: minioLatency,
                    self: 0,
                    average: Math.round((mongooseLatency + redisLatency + minioLatency) / 3)
                };

                this.cachedResponseTimes = {
                    expiresAt: Date.now() + HEALTH_CHECK_CACHE_TTL_MS,
                    value: responseTimes
                };

                return responseTimes;
            })
            .finally(() => {
                this.pendingCollection = null;
            });

        return this.pendingCollection;
    }
}
