import { injectable, inject, singleton } from 'tsyringe';
import { pipeline } from 'node:stream/promises';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IPluginBinaryCacheService, BinaryCacheRequest } from '../../domain/ports/IPluginBinaryCacheService';
import { ITempFileService } from '@/src/shared/domain/ports/ITempFileService';
import { IStorageService } from '@/src/shared/domain/ports/IStorageService';
import logger from '@/src/shared/infrastructure/logger';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { SYS_BUCKETS } from '@/src/core/minio';
import { createReadStream, createWriteStream } from 'node:fs';

@singleton()
@injectable()
export default class PluginBinaryCacheService implements IPluginBinaryCacheService{
    private readonly cacheDir: string;
    private readonly locks = new Map<string, Promise<string>>();

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private storageService: IStorageService,

        @inject(SHARED_TOKENS.TempFileService)
        private tempService: ITempFileService
    ){
        this.cacheDir = this.tempService.getDirPath('plugin-bin-cache');
    }

    async getBinaryPath(request: BinaryCacheRequest): Promise<string>{
        await this.ensureCacheDir();
    
        // Check if a download is already in progress for this binary
        if(this.locks.has(request.binaryHash)){
            logger.debug(`@plugin-binary-cache-service: waiting for existing download: ${request.binaryHash}`);
            return this.locks.get(request.binaryHash)!;
        }

        // Create the promise and set the lock
        const promise = this.resolveBinary(request, request.binaryHash)
            .finally(() => this.locks.delete(request.binaryHash));

        this.locks.set(request.binaryHash, promise);

        return promise;
    }

    private async resolveBinary(request: BinaryCacheRequest, cacheKey: string): Promise<string>{
        const name = `${request.pluginSlug}-${request.binaryHash}`;
        const finalPath = path.join(this.cacheDir, name);

        // Check existence
        if(await this.isValidBinary(finalPath, request.binaryHash)){
            // Update access time (touch)
            const now = new Date();
            await fs.utimes(finalPath, now, now).catch(() => {});
            return finalPath;
        }

        logger.info(`@plugin-binary-cache-service: Cache miss. Downloading: ${request.binaryObjectPath}`);

        // Download to a temporary file first
        const tempPath = `${finalPath}.tmp.${Date.now()}`;
        try{
            const stream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, request.binaryObjectPath);
            const writeStream = createWriteStream(tempPath);

            await pipeline(stream, writeStream);

            // Verify integrity
            if(request.binaryHash){
                const calculatedHash = await this.calculateFileHash(tempPath);
                if(calculatedHash !== request.binaryHash){
                    throw new Error(`Binary integrity check failed. Expected ${request.binaryHash}, got ${calculatedHash}`);
                }
            }

            // Set permissions (rwx-r-x-r-x)
            await fs.chmod(tempPath, 0o755);

            await fs.rename(tempPath, finalPath);

            logger.info(`@plugin-binary-cache-service: cached successfully: ${finalPath}`);
            return finalPath;
        }catch(error: any){
            await fs.unlink(tempPath).catch(() => {});
            logger.error(`@plugin-binary-cache-service: failed to download binary: ${request.binaryObjectPath}`, error);
            throw error;
        }
    }

    private async calculateFileHash(filePath: string): Promise<string>{
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = createReadStream(filePath);
            stream.on('error', (err) => reject(err));
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    private async ensureCacheDir(): Promise<void>{
        try{
            await fs.access(this.cacheDir);
        }catch{
            await fs.mkdir(this.cacheDir, { recursive: true });
        }
    }

    private async isValidBinary(filePath: string, expectedHash?: string): Promise<boolean>{
        try{
            await fs.access(filePath, fs.constants.X_OK);
            if(!expectedHash) return true;
            // TODO: verify hash
            return true;
        }catch{
            return false;
        }
    }
};