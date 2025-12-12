import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import logger from '@/logger';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const CACHE_DIR = process.env.BINARY_CACHE_DIR || '/var/cache/volterra/binaries';

class BinaryCache{
    private initialized = false;

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

        const writeStream = createWriteStream(cachePath);
        await pipeline(stream, writeStream);

        await fs.chmod(cachePath, 0o755);

        logger.info(`[BinaryCache] Cached binary: ${hash}`);
        return cachePath;
    }

    async putBuffer(hash: string, buffer: Buffer): Promise<string>{
        await this.ensureDir();
        const cachePath = this.getCachePath(hash);

        await fs.writeFile(cachePath, buffer);
        await fs.chmod(cachePath, 0o755);

        logger.info(`[BinaryCache] Cached binary from buffer: ${hash}`);
        return cachePath;
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