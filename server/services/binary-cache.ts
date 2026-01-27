import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import logger from '@/logger';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const CACHE_DIR = process.env.BINARY_CACHE_DIR || '/var/cache/Volt/binaries';

class BinaryCache{
    private initialized = false;
    private downloadLocks = new Map<string, Promise<string>>();

    private async ensureDir(): Promise<void>{
        if(this.initialized) return;
        
        try{
            await fs.mkdir(CACHE_DIR, { recursive: true });
            this.initialized = true;
        }catch(err: any){
            logger.error(`[BinaryCache] Failed to create cache dir: ${err.message}`);
            throw err;
        }
    }

    private getCachePath(hash: string): string{
        return path.join(CACHE_DIR, hash);
    }

    async exists(hash: string): Promise<boolean>{
        try{
            await fs.access(this.getCachePath(hash));
            return true;
        }catch{
            return false;
        }
    }

    async get(hash: string): Promise<string | null>{
        await this.ensureDir();

        // Wait if there's a download in progress
        const pendingDownload = this.downloadLocks.get(hash);
        if(pendingDownload){
            logger.debug(`[BinaryCache] Waiting for pending download: ${hash}`);
            await pendingDownload;
        }

        const cachePath = this.getCachePath(hash);
        if(await this.exists(hash)){
            logger.debug(`[BinaryCache] Cache hit: ${hash}`);
            return cachePath;
        }
        logger.debug(`[BinaryCache] Cache miss: ${hash}`);
        return null;
    }

    async put(hash: string, stream: Readable): Promise<string>{
        await this.ensureDir();
        const cachePath = this.getCachePath(hash);

        // Check if already exists
        const exists = await this.exists(hash);
        if(exists){
            logger.debug(`[BinaryCache] Binary already cached: ${hash}`);
            return cachePath;
        }

        // Check if there's a download in progress
        const existingLock = this.downloadLocks.get(hash);
        if(existingLock){
            logger.debug(`[BinaryCache] Download already in progress, waiting: ${hash}`);
            return existingLock;
        }

        // Create lock with the download promise
        const downloadPromise = (async () => {
            try{
                const tempPath = `${cachePath}.tmp`;
                const writeStream = createWriteStream(tempPath);
                await pipeline(stream, writeStream);
                await fs.chmod(tempPath, 0o755);
                await fs.rename(tempPath, cachePath);

                logger.info(`[BinaryCache] Cached binary: ${hash}`);
                return cachePath;
            }finally{
                this.downloadLocks.delete(hash);
            }
        })();

        this.downloadLocks.set(hash, downloadPromise);
        return downloadPromise;
    }

    async putBuffer(hash: string, buffer: Buffer): Promise<string>{
        await this.ensureDir();
        const cachePath = this.getCachePath(hash);

        // Check if already exists
        const exists = await this.exists(hash);
        if(exists){
            logger.debug(`[BinaryCache] Binary already cached: ${hash}`);
            return cachePath;
        }

        // Check if there's a download in progress
        const existingLock = this.downloadLocks.get(hash);
        if(existingLock){
            logger.debug(`[BinaryCache] Download already in progress, waiting: ${hash}`);
            return existingLock;
        }

        // Create lock with the download promise
        const downloadPromise = (async () => {
            try{
                const tempPath = `${cachePath}.tmp`;
                await fs.writeFile(tempPath, buffer);
                await fs.chmod(tempPath, 0o755);
                await fs.rename(tempPath, cachePath);

                logger.info(`[BinaryCache] Cached binary from buffer: ${hash}`);
                return cachePath;
            }finally{
                this.downloadLocks.delete(hash);
            }
        })();

        this.downloadLocks.set(hash, downloadPromise);
        return downloadPromise;
    }

    static async computeHash(filePath: string): Promise<string>{
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = createReadStream(filePath);
            stream.on('data', (data: any) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }

    static hashBuffer(buffer: Buffer): string{
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }
};

const binaryCache = new BinaryCache();

export default binaryCache;
