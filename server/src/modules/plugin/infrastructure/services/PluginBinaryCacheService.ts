import { injectable, inject, singleton } from 'tsyringe';
import { pipeline } from 'node:stream/promises';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IPluginBinaryCacheService, BinaryCacheRequest } from '@modules/plugin/domain/ports/IPluginBinaryCacheService';
import { ITempFileService } from '@shared/domain/ports/ITempFileService';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import logger from '@shared/infrastructure/logger';
import path from 'node:path';
import fs from 'node:fs/promises';
import { SYS_BUCKETS } from '@core/config/minio';
import { createWriteStream } from 'node:fs';

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

        const cacheKey = this.buildCacheKey(request);

        // Check if a download is already in progress for this binary+plugin combination
        if(this.locks.has(cacheKey)){
            logger.debug(`@plugin-binary-cache-service: waiting for existing download: ${cacheKey}`);
            return this.locks.get(cacheKey)!;
        }

        // Create the promise and set the lock
        const promise = this.resolveBinary(request, cacheKey)
            .finally(() => this.locks.delete(cacheKey));

        this.locks.set(cacheKey, promise);

        return promise;
    }

    async evictByPluginId(pluginId: string): Promise<void>{
        await this.ensureCacheDir();

        const prefix = `${pluginId}-`;

        try{
            const entries = await fs.readdir(this.cacheDir);
            const matchingFiles = entries.filter((entry) => entry.startsWith(prefix));

            if(matchingFiles.length === 0) return;

            const deletionPromises = matchingFiles.map((fileName) => {
                const filePath = path.join(this.cacheDir, fileName);
                return fs.unlink(filePath).catch(() => {});
            });

            await Promise.all(deletionPromises);

            logger.info(`@plugin-binary-cache-service: evicted ${matchingFiles.length} cached file(s) for plugin ${pluginId}`);
        }catch(error){
            logger.warn(`@plugin-binary-cache-service: failed to evict cache for plugin ${pluginId}: ${error}`);
        }
    }

    private buildCacheKey(request: BinaryCacheRequest): string{
        // Use the basename of the object path (a UUID per upload) as the cache identifier.
        // Each upload generates a unique objectPath, so cache invalidation is automatic.
        const objectBasename = path.basename(request.binaryObjectPath);
        return `${request.pluginId}-${objectBasename}`;
    }

    private async resolveBinary(request: BinaryCacheRequest, cacheKey: string): Promise<string>{
        const finalPath = path.join(this.cacheDir, cacheKey);

        // Check if file exists and is executable (objectPath identifier is embedded in filename)
        if(await this.isExecutable(finalPath)){
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

            // Set permissions (rwx-r-x-r-x)
            await fs.chmod(tempPath, 0o755);

            await fs.rename(tempPath, finalPath);

            logger.info(`@plugin-binary-cache-service: cached successfully: ${finalPath}`);
            return finalPath;
        }catch(error){
            await fs.unlink(tempPath).catch(() => {});
            logger.error(`@plugin-binary-cache-service: failed to download binary: ${request.binaryObjectPath}: ${error}`);
            throw error;
        }
    }

    private async ensureCacheDir(): Promise<void>{
        try{
            await fs.access(this.cacheDir);
        }catch{
            await fs.mkdir(this.cacheDir, { recursive: true });
        }
    }

    private async isExecutable(filePath: string): Promise<boolean>{
        try{
            await fs.access(filePath, fs.constants.X_OK);
            return true;
        }catch{
            return false;
        }
    }
};
