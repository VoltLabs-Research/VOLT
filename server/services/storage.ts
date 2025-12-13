import { getMinioClient } from '@/config/minio';
import { Client, ItemBucketMetadata, BucketItemStat } from 'minio';
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
class StorageService{
    private readonly client: Client;
    private readonly config: {
        readonly endpoint: string;
        readonly port: number;
        readonly protocol: string;
        readonly urlBase: string;
    };

    constructor(){
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
    ): Promise<void>{
        if(typeof source === 'string'){
            // Delegates stream handling and checksums to the native driver/OS
            await this.client.fPutObject(bucket, objectName, source, metadata);
        }else if(Buffer.isBuffer(source)){
            // Buffer(Memory already allocated)
            await this.client.putObject(bucket, objectName, source, source.length, metadata);
        }else{
            // Generic Stream(TODO: check this)
            await this.client.putObject(bucket, objectName, source, undefined, metadata);
        }
    }

    /**
     * Downloads an object directly to the local filesystem.
     * Avoids loading the file into the Node.js Heap, allowing multi-GB downloads
     * with negligible RAM consumption(restricted only by internal I/O buffers).
     * @param bucket - The bucket name.
     * @param objectName - The object key.
     * @param destPath - Local filesystem path where the file will be saved.
     */
    public async download(bucket: string, objectName: string, destPath: string): Promise<void>{
        await this.client.fGetObject(bucket, objectName, destPath);
    }

    /**
     * Retrieves a readable stream of the object.
     * Useful for piping directly to an HTTP Response without toching the disk.
     * @param bucket - The source bucket.
     * @param objectName - The object key.
     * @returns A Readable stream of the file content.
     */
    public async getStream(bucket: string, objectName: string): Promise<Readable>{
        return this.client.getObject(bucket, objectName);
    }

    /**
     * Reads an entire object into memory.
     * High RAM Impact. This operations loads the entire file into the Heap.
     * @param bucket - The source bucket.
     * @param objectName - The object key.
     * @returns A Buffer containing the file data.
     */
    public async getBuffer(bucket: string, objectName: string): Promise<Buffer>{
        const stream = await this.client.getObject(bucket, objectName);
        const chunks: Buffer[] = [];
        for await (const chunk of stream){
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
    public async exists(bucket: string, objectName: string): Promise<boolean>{
        try{
            await this.client.statObject(bucket, objectName);
            return true;
        }catch(error: any){
            if(error.code === 'NotFound') return false;
            throw error;
        }
    }

    /**
     * Retrieves technical metadata(size, etag, contentType, lastModified).
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     */
    public async getStat(bucket: string, objectName: string): Promise<BucketItemStat>{
        return this.client.statObject(bucket, objectName);
    }

    /**
     * Deletes a single object.
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     */
    public async delete(bucket: string, objectName: string): Promise<void>{
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
    public async *listByPrefix(bucket: string, prefix: string, recursive: boolean = true): AsyncIterable<string>{
        const stream = this.client.listObjectsV2(bucket, prefix, recursive);
        // Pass-through the stream, extracting only the name to save CPU/RAM
        // from holding the full BucketItem object structure.
        for await (const obj of stream){
            if(obj.name) yield obj.name;
        }
    }

    /**
     * Efficiently deletes multiple objects by prefix using Batch & Drain strategy.
     * It does not list all keys at once. It uses an async iterator to fill a fixed-size
     * bucket(1000 items). Once full, it pauses listing, deletes the batch, frees memory, and continues.
     * @param bucket - Target bucket.
     * @param prefix - Folder prefix(e.g., "temp/").
     */
    public async deleteByPrefix(bucket: string, prefix: string): Promise<void>{
        const stream = this.client.listObjectsV2(bucket, prefix, true);
        const BATCH_SIZE = 1000;
        let batch: string[] = [];
        for await (const obj of stream){
            if(obj.name) batch.push(obj.name);
            // Drain batch if limit reached
            if(batch.length >= BATCH_SIZE){
                await this.processDeleteBatch(bucket, batch);
                // Reset array for GC!
                batch = [];
            }
        }
        // Delete reamining items
        if(batch.length > 0){
            await this.processDeleteBatch(bucket, batch);
        }
    }

    /**
     * Generates a public URL for anonymous access.
     * Pure string operation, negligible computational cost.
     * @param bucket - The target bucket.
     * @param objectName - The object key.
     */
    public getPublicURL(bucket: string, objectName: string): string{
        return `${this.config.urlBase}/${bucket}/${objectName}`;
    }

    private async processDeleteBatch(bucket: string, keys: string[]): Promise<void>{
        if(keys.length === 0) return;
        logger.info(`[Storage] Deleting batch of ${keys.length} items from ${bucket}`);
        await this.client.removeObjects(bucket, keys);
    }
};

// singleton
const storage = new StorageService();

export default storage;
