import http from 'http';
import https from 'https';
import mongoose from 'mongoose';
import { injectable } from 'tsyringe';
import { redis } from '@core/config/redis';
import { readNumberEnv } from '@shared/infrastructure/utilities/env';
import type { ResponseTimes } from '@modules/system/domain/value-objects/SystemMetrics';

const PING_TIMEOUT = 2000;
const PING_FAILURE_VALUE = 999;

@injectable()
export default class ServiceHealthPinger {
    private pingHost(host: string): Promise<number> {
        return new Promise((resolve) => {
            const start = Date.now();
            const protocol = host.startsWith('https') ? https : http;
            const url = new URL(host.includes('://') ? host : `http://${host}`);

            const req = protocol.get({
                hostname: url.hostname,
                port: url.port || (protocol === https ? 443 : 80),
                path: '/',
                timeout: PING_TIMEOUT
            }, () => {
                resolve(Date.now() - start);
                req.destroy();
            });

            req.on('error', () => resolve(PING_FAILURE_VALUE));
            req.on('timeout', () => {
                req.destroy();
                resolve(PING_FAILURE_VALUE);
            });
        });
    }

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
        const selfLatency = await this.pingHost(`0.0.0.0:${readNumberEnv('SERVER_PORT', 8000)}`);

        return {
            mongodb: mongooseLatency,
            redis: redisLatency,
            minio: minioLatency,
            self: selfLatency,
            average: Math.round((mongooseLatency + redisLatency + minioLatency + selfLatency) / 4)
        };
    }
}
