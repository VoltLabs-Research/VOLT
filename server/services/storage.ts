import { getMinioClient } from '@/config/minio';
import { Client, ItemBucketMetadata, BucketItemStat, CopyDestinationOptions, CopySourceOptions } from 'minio';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { Readable } from 'node:stream';
import logger from '@/logger';

/**
 * Supported data types for upload operations.
 */
export type UploadSource = string | Buffer | Readable;

/**
 * Storage Service. This service implements streaming strategies and batch management to avoid
 * memory spikes, making it suitable for high-throughput environments.
 */
class StorageService {
    private static readonly MIN_PART_SIZE = 5 * 1024 * 1024;
    private static readonly MAX_PARTS = 1000;
    private static readonly DEFAULT_PART_SIZE = 8 * 1024 * 1024;
    private static readonly CHUNK_PREFIX = '__chunks__';

    private readonly client: Client;
    private readonly config: {
        readonly endpoint: string;
        readonly port: number;
        readonly protocol: string;
        readonly urlBase: string;
    };
    private readonly uploadConcurrency: number;

    constructor() {
        this.client = getMinioClient();

        const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
        const port = parseInt(process.env.MINIO_PORT || '9000', 10);
        const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';

        this.config = {
            endpoint,
            port,
            protocol,
            urlBase: `${protocol}://${endpoint}${port === 80 || port === 443 ? '' : `:${port}`}`
        };
        this.uploadConcurrency = Math.max(2, Math.min(8, os.cpus().length));
    }

    /**
     * Uploads an object to the storage bucket.
     * @param bucket - The target bucket name.
     * @param objectName - The destination object key/name.
     * @param source - Local file path, Buffer, or Readable Stream.
     * @param metadata - Optional key-value metadata
     */
    public async put(
        bucket: string,
        objectName: string,
        source: UploadSource,
        metadata: ItemBucketMetadata = {}
    ): Promise<void> {
        if (this.isChunkObject(objectName)) {
            await this.putRaw(bucket, objectName, source, metadata);
            return;
        }

        const sizeHint = await this.getSourceSize(source, metadata);
        const initialChunkSize = this.resolveChunkSize(sizeHint);
        const uploadId = randomUUID();
        const chunkPrefix = `${StorageService.CHUNK_PREFIX}/${uploadId}`;
        const chunkObjects: string[] = [];
        const inFlight = new Set<Promise<void>>();

        const headers = this.normalizeHeaders(metadata);

        const cleanupChunks = async () => {
            if (chunkObjects.length === 0) return;
            await this.client.removeObjects(bucket, chunkObjects).catch(() => { });
        };

        const uploadChunk = async (chunk: Buffer, index: number) => {
            const chunkName = `${chunkPrefix}/part-${String(index).padStart(6, '0')}`;
            chunkObjects.push(chunkName);

            const promise = this.client
                .putObject(bucket, chunkName, chunk, chunk.length, { 'Content-Type': 'application/octet-stream' })
                .then(() => undefined)
                .finally(() => inFlight.delete(promise));

            inFlight.add(promise);
            if (inFlight.size >= this.uploadConcurrency) {
                await Promise.race(inFlight);
            }
        };

        try {
            let partIndex = 0;
            for await (const chunk of this.iterateChunks(source, initialChunkSize, sizeHint)) {
                await uploadChunk(chunk, partIndex);
                partIndex++;
            }

            if (inFlight.size > 0) {
                await Promise.all(inFlight);
            }

            if (chunkObjects.length === 0) {
                await this.client.putObject(bucket, objectName, Buffer.alloc(0), 0, headers);
                return;
            }

            const destOptions = new CopyDestinationOptions({
                Bucket: bucket,
                Object: objectName,
                MetadataDirective: 'REPLACE',
                Headers: headers
            });
            const sources = chunkObjects.map((name) => new CopySourceOptions({ Bucket: bucket, Object: name }));
            await this.client.composeObject(destOptions, sources);
        } catch (error) {
            if (inFlight.size > 0) {
                await Promise.allSettled(inFlight);
            }
            await cleanupChunks();
            throw error;
        }

        await cleanupChunks();
    }

    /**
     * Downloads an object directly to the local filesystem.
     * Avoids loading the file into the Node.js Heap, allowing multi-GB downloads
     * with negligible RAM consumption(restricted only by internal I/O buffers).
     * @param bucket - The bucket name.
     * @param objectName - The object key.
     * @param destPath - Local filesystem path where the file will be saved.
     */
    public async download(bucket: string, objectName: string, destPath: string): Promise<void> {
        await this.client.fGetObject(bucket, objectName, destPath);
    }

    /**
     * Retrieves a readable stream of the object.
     * Useful for piping directly to an HTTP Response without toching the disk.
     * @param bucket - The source bucket.
     * @param objectName - The object key.
     * @returns A Readable stream of the file content.
     */
    public async getStream(bucket: string, objectName: string): Promise<Readable> {
        return this.client.getObject(bucket, objectName);
    }

    /**
     * Reads an entire object into memory.
     * High RAM Impact. This operations loads the entire file into the Heap.
     * @param bucket - The source bucket.
     * @param objectName - The object key.
     * @returns A Buffer containing the file data.
     */
    public async getBuffer(bucket: string, objectName: string): Promise<Buffer> {
        const stream = await this.client.getObject(bucket, objectName);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
        }
        return Buffer.concat(chunks);
    }

    /**
     * Verifies object existence by checking metadata only(HEAD request).
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     * @returns True if exists, false otherwise.
     */
    public async exists(bucket: string, objectName: string): Promise<boolean> {
        try {
            await this.client.statObject(bucket, objectName);
            return true;
        } catch (error: any) {
            if (error.code === 'NotFound') return false;
            throw error;
        }
    }

    /**
     * Retrieves technical metadata(size, etag, contentType, lastModified).
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     */
    public async getStat(bucket: string, objectName: string): Promise<BucketItemStat> {
        return this.client.statObject(bucket, objectName);
    }

    /**
     * Alias for getStat to match waiting logic requirement
     */
    public async stat(bucket: string, objectName: string): Promise<BucketItemStat> {
        return this.getStat(bucket, objectName);
    }

    /**
     * Deletes a single object.
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     */
    public async delete(bucket: string, objectName: string): Promise<void> {
        await this.client.removeObject(bucket, objectName);
    }

    /**
     * List objects keys using a non-blocking Async Generator.
     * @remarks
     * Returns an `AsyncIterable` instead of an Array. This ensures **O(1) Memory usage**.
     * It yields keys one by one as they arrive from the network, preventing Heap overflows on large datasets.
     * @param bucket - Target bucket.
     * @param prefix - Filter prefix.
     * @param recursive - Whether to list sub-folders recursively. Defaults to true.
     * @returns An AsyncIterable that yields object keys(strings).
     */
    public async *listByPrefix(bucket: string, prefix: string, recursive: boolean = true): AsyncIterable<string> {
        const stream = this.client.listObjectsV2(bucket, prefix, recursive);
        // Pass-through the stream, extracting only the name to save CPU/RAM
        // from holding the full BucketItem object structure.
        for await (const obj of stream) {
            if (obj.name) yield obj.name;
        }
    }

    /**
     * Efficiently deletes multiple objects by prefix using Batch & Drain strategy.
     * It does not list all keys at once. It uses an async iterator to fill a fixed-size
     * bucket(1000 items). Once full, it pauses listing, deletes the batch, frees memory, and continues.
     * @param bucket - Target bucket.
     * @param prefix - Folder prefix(e.g., "temp/").
     */
    public async deleteByPrefix(bucket: string, prefix: string): Promise<void> {
        const stream = this.client.listObjectsV2(bucket, prefix, true);
        const BATCH_SIZE = 1000;
        let batch: string[] = [];
        for await (const obj of stream) {
            if (obj.name) batch.push(obj.name);
            // Drain batch if limit reached
            if (batch.length >= BATCH_SIZE) {
                await this.processDeleteBatch(bucket, batch);
                // Reset array for GC!
                batch = [];
            }
        }
        // Delete reamining items
        if (batch.length > 0) {
            await this.processDeleteBatch(bucket, batch);
        }
    }

    /**
     * Generates a public URL for anonymous access.
     * Pure string operation, negligible computational cost.
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     */
    public getPublicURL(bucket: string, objectName: string): string {
        return `${this.config.urlBase}/${bucket}/${objectName}`;
    }

    private async processDeleteBatch(bucket: string, keys: string[]): Promise<void> {
        if (keys.length === 0) return;
        logger.info(`[Storage] Deleting batch of ${keys.length} items from ${bucket}`);
        await this.client.removeObjects(bucket, keys);
    }

    private resolveChunkSize(totalBytes: number | null): number {
        if (!totalBytes || totalBytes <= 0) return StorageService.DEFAULT_PART_SIZE;
        const byMaxParts = Math.ceil(totalBytes / StorageService.MAX_PARTS);
        return Math.max(StorageService.MIN_PART_SIZE, byMaxParts);
    }

    private resolveUnknownChunkSize(bytesProcessed: number): number {
        const GB = 1024 * 1024 * 1024;
        if (bytesProcessed >= 8 * GB) return 64 * 1024 * 1024;
        if (bytesProcessed >= 2 * GB) return 32 * 1024 * 1024;
        if (bytesProcessed >= 512 * 1024 * 1024) return 16 * 1024 * 1024;
        return StorageService.DEFAULT_PART_SIZE;
    }

    private normalizeHeaders(metadata: ItemBucketMetadata): Record<string, string> {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (value == null) continue;
            if (key.toLowerCase() === 'content-length') continue;
            headers[key] = String(value);
        }
        return headers;
    }

    private async getSourceSize(
        source: UploadSource,
        metadata: ItemBucketMetadata
    ): Promise<number | null> {
        if (Buffer.isBuffer(source)) return source.length;
        if (typeof source === 'string') {
            const fileStat = await stat(source);
            return fileStat.size;
        }

        const metaLength = metadata['Content-Length'] || metadata['content-length'];
        if (metaLength) {
            const parsed = Number(metaLength);
            if (Number.isFinite(parsed) && parsed >= 0) return parsed;
        }

        const pathValue = (source as any)?.path;
        if (typeof pathValue === 'string') {
            try {
                const fileStat = await stat(pathValue);
                return fileStat.size;
            } catch {
                return null;
            }
        }

        return null;
    }

    private async putRaw(
        bucket: string,
        objectName: string,
        source: UploadSource,
        metadata: ItemBucketMetadata
    ): Promise<void> {
        if (typeof source === 'string') {
            const fileStat = await stat(source);
            const stream = createReadStream(source, { highWaterMark: StorageService.DEFAULT_PART_SIZE });
            await this.client.putObject(bucket, objectName, stream, fileStat.size, metadata);
            return;
        }

        if (Buffer.isBuffer(source)) {
            await this.client.putObject(bucket, objectName, source, source.length, metadata);
            return;
        }

        await this.client.putObject(bucket, objectName, source, undefined, metadata);
    }

    private async *iterateChunks(
        source: UploadSource,
        initialChunkSize: number,
        totalBytes: number | null
    ): AsyncIterable<Buffer> {
        if (Buffer.isBuffer(source)) {
            const size = source.length;
            const chunkSize = totalBytes ? initialChunkSize : this.resolveUnknownChunkSize(size);
            for (let offset = 0; offset < size; offset += chunkSize) {
                yield source.subarray(offset, Math.min(size, offset + chunkSize));
            }
            return;
        }

        const stream = typeof source === 'string'
            ? createReadStream(source, { highWaterMark: Math.min(initialChunkSize, StorageService.DEFAULT_PART_SIZE) })
            : source;

        const buffers: Buffer[] = [];
        let bufferedBytes = 0;
        let bytesProcessed = 0;
        let chunkSize = initialChunkSize;
        let chunkCount = 0;

        for await (const chunk of stream as AsyncIterable<Buffer>) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            buffers.push(buf);
            bufferedBytes += buf.length;

            while (bufferedBytes >= chunkSize) {
                const out = this.takeBuffers(buffers, chunkSize);
                bufferedBytes -= out.length;
                bytesProcessed += out.length;
                yield out;
                chunkCount++;
                if (!totalBytes) {
                    const sizeByBytes = this.resolveUnknownChunkSize(bytesProcessed);
                    let sizeByCount = 0;
                    if (chunkCount >= StorageService.MAX_PARTS * 0.95) sizeByCount = 128 * 1024 * 1024;
                    else if (chunkCount >= StorageService.MAX_PARTS * 0.9) sizeByCount = 64 * 1024 * 1024;
                    else if (chunkCount >= StorageService.MAX_PARTS * 0.8) sizeByCount = 32 * 1024 * 1024;
                    chunkSize = Math.max(sizeByBytes, sizeByCount, StorageService.MIN_PART_SIZE);
                }
            }
        }

        if (bufferedBytes > 0) {
            const out = this.takeBuffers(buffers, bufferedBytes);
            yield out;
        }
    }

    private takeBuffers(buffers: Buffer[], size: number): Buffer {
        let remaining = size;
        const parts: Buffer[] = [];

        while (remaining > 0 && buffers.length > 0) {
            const buf = buffers[0];
            if (buf.length <= remaining) {
                parts.push(buf);
                buffers.shift();
                remaining -= buf.length;
            } else {
                parts.push(buf.subarray(0, remaining));
                buffers[0] = buf.subarray(remaining);
                remaining = 0;
            }
        }

        return parts.length === 1 ? parts[0] : Buffer.concat(parts, size);
    }

    private isChunkObject(objectName: string): boolean {
        return objectName.startsWith(`${StorageService.CHUNK_PREFIX}/`);
    }
};

// singleton
const storage = new StorageService();

export default storage;
