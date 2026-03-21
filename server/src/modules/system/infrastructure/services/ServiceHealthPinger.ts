import mongoose from 'mongoose';
import { injectable } from 'tsyringe';
import { redis } from '@core/config/redis';
import type { ResponseTimes } from '@modules/system/domain/value-objects/SystemMetrics';

@injectable()
export default class ServiceHealthPinger {
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
        const mongooseLatency = await this.pingMongoose();
        const redisLatency = await this.pingRedis();
        const minioLatency = await this.pingMinIO();

        return {
            mongodb: mongooseLatency,
            redis: redisLatency,
            minio: minioLatency,
            self: 0,
            average: Math.round((mongooseLatency + redisLatency + minioLatency) / 3)
        };
    }
}
