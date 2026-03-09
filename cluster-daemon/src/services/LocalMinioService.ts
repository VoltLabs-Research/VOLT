import { ObjectBucketName } from '../contracts/http';
import { DaemonConfig } from '../config/env';
import { Client } from 'minio';
import { logger } from './logger';
import type { Readable } from 'node:stream';

export interface PutObjectInput {
    bucket: string;
    objectKey: string;
    body: Buffer;
    metadata?: Record<string, string>;
};

export class LocalMinioService {
    private readonly client: Client;

    constructor(config: DaemonConfig) {
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
        for (const bucket of Object.values(ObjectBucketName)) {
            const exists = await this.client.bucketExists(bucket);
            if (!exists) {
                await this.client.makeBucket(bucket);
                logger.info(`Created MinIO bucket: ${bucket}`);
            }
        }
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
}
