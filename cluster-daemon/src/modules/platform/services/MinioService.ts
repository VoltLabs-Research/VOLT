import { logger } from '@/core/logger';
import { Client } from 'minio';
import type { DaemonConfig } from '@/core/config';
import type { Readable } from 'node:stream';

export interface PutObjectInput {
    bucket: string;
    objectKey: string;
    body: Buffer;
    metadata?: Record<string, string>;
};

export class MinioService {
    private readonly client: Client;

    constructor(
        private readonly config: DaemonConfig
    ) {
        const minioUrl = new URL(config.minio.endpoint);
        this.client = new Client({
            endPoint: minioUrl.hostname,
            port: Number(minioUrl.port || (minioUrl.protocol === 'https:' ? 443 : 80)),
            useSSL: minioUrl.protocol === 'https:' || config.minio.useSSL,
            accessKey: config.minio.accessKey,
            secretKey: config.minio.secretKey
        });
    }

    async ensureBuckets(): Promise<void> {
        for (const bucket of this.config.allowedBuckets) {
            const exists = await this.client.bucketExists(bucket);
            if (!exists) {
                await this.client.makeBucket(bucket);
                logger.info(`Created MinIO bucket: ${bucket}`);
            }
        }
    }

    listBuckets(): string[] {
        return [...this.config.allowedBuckets];
    }

    getObjectStream(bucket: string, objectKey: string): Promise<Readable> {
        return this.client.getObject(bucket, objectKey);
    }

    statObject(bucket: string, objectKey: string) {
        return this.client.statObject(bucket, objectKey);
    }

    async putObject(input: PutObjectInput): Promise<void> {
        await this.client.putObject(input.bucket, input.objectKey, input.body, input.body.length, input.metadata);
    }

    async listObjects(bucket: string, prefix: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            const keys: string[] = [];
            const stream = this.client.listObjectsV2(bucket, prefix, true);

            stream.on('data', (item) => {
                if (item.name) {
                    keys.push(item.name);
                }
            });
            stream.on('end', () => resolve(keys));
            stream.on('error', (error) => reject(error));
        });
    }

    async removeObject(bucket: string, objectKey: string): Promise<void> {
        await this.client.removeObject(bucket, objectKey);
    }
};
