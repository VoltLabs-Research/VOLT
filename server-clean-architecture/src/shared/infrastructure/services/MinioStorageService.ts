import { injectable } from 'tsyringe';
import { Client } from 'minio';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getMinioClient, getMinioConfig } from '@core/config/minio';
import { IStorageService, UploadSource, FileMetadata } from '@shared/domain/ports/IStorageService';
import logger from '@shared/infrastructure/logger';

@injectable()
export default class MinioStorageService implements IStorageService {
    private readonly client: Client;
    private urlBase: string;

    constructor() {
        this.client = getMinioClient();

        const minioConfig = getMinioConfig();
        const protocol = minioConfig.useSSL ? 'https' : 'http';
        this.urlBase = `${protocol}://${minioConfig.endPoint}:${minioConfig.port}`;
    }

    async upload(
        bucket: string,
        objectName: string,
        source: UploadSource,
        metadata: Record<string, string> = {}
    ): Promise<void> {
        if (typeof source === 'string') {
            const fileStat = await stat(source);
            const stream = createReadStream(source);
            await this.client.putObject(bucket, objectName, stream, fileStat.size, metadata);
            return;
        }

        if (Buffer.isBuffer(source)) {
            await this.client.putObject(bucket, objectName, source, source.length, metadata);
            return;
        }

        // stream
        await this.client.putObject(bucket, objectName, source, undefined, metadata);
    }

    async getStream(bucket: string, objectName: string): Promise<Readable> {
        return this.client.getObject(bucket, objectName);
    }

    async getBuffer(bucket: string, objectName: string): Promise<Buffer> {
        const stream = await this.client.getObject(bucket, objectName);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    async exists(bucket: string, objectName: string): Promise<boolean> {
        try {
            await this.client.statObject(bucket, objectName);
            return true;
        } catch (error: any) {
            if (error.code === 'NotFound') return false;
            throw error;
        }
    }

    async delete(bucket: string, objectName: string): Promise<void> {
        await this.client.removeObject(bucket, objectName);
    }

    getPublicURL(bucket: string, objectName: string): string {
        return `${this.urlBase}/${bucket}/${objectName}`;
    }

    async getStat(bucket: string, objectName: string): Promise<FileMetadata> {
        const stat = await this.client.statObject(bucket, objectName);
        return {
            size: stat.size,
            mimetype: stat.metaData['content-type'],
            etag: stat.etag,
            lastModified: stat.lastModified,
            ...stat.metaData
        };
    }

    async download(bucket: string, objectName: string, destPath: string): Promise<void> {
        const stream = await this.client.getObject(bucket, objectName);
        const writeStream = createWriteStream(destPath);
        await pipeline(stream, writeStream);
    }

    async *listByPrefix(bucket: string, prefix: string, recursive: boolean = true): AsyncIterable<string> {
        const stream = this.client.listObjectsV2(bucket, prefix, recursive);
        for await (const obj of stream) {
            if (obj.name) yield obj.name;
        }
    };

    async deleteByPrefix(bucket: string, prefix: string): Promise<void> {
        const stream = this.client.listObjectsV2(bucket, prefix, true);
        const BATCH_SIZE = 1000;
        let batch: string[] = [];
        for await (const obj of stream) {
            if (obj.name) batch.push(obj.name);
            if (batch.length >= BATCH_SIZE) {
                await this.processDeleteBatch(bucket, batch);
                batch = [];
            }
        }
        if (batch.length > 0) {
            await this.processDeleteBatch(bucket, batch);
        }
    }

    private async processDeleteBatch(bucket: string, keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        logger.info(`@minio-storage-service: deleting batch of ${keys.length} items from ${bucket}`);
        await this.client.removeObjects(bucket, keys);
    }
};