import { injectable, inject } from 'tsyringe';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { pipeline } from 'node:stream/promises';
import { ITempFileService } from '@shared/domain/ports/ITempFileService';
import { SYS_BUCKETS } from '@core/config/minio';
import { Readable } from 'node:stream';
import { createReadStream, createWriteStream } from 'node:fs';
import logger from '@shared/infrastructure/logger';
import pLimit from '@shared/infrastructure/utilities/p-limit';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

@injectable()
export default class TrajectoryDumpStorageService implements ITrajectoryDumpStorageService{
    private static readonly COMPRESSION_LEVEL = zlib.constants.Z_BEST_SPEED;
    private static RAM_THRESHOLD = 4 * 1024 * 1024;
    private static readonly CACHE_TTL_MS = 30 * 60 * 1000;
    private readonly cacheDir: string;
    private readonly pendingRequests = new Map<string, Promise<string | null>>();
    public static storageLimit = pLimit(50);

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TempFileService)
        private readonly tempFileService: ITempFileService
    ){
        this.cacheDir = this.tempFileService.getDirPath('trajectory-cache');
    }

    getObjectName(trajectoryId: string, timestep: string): string{
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }

    getPrefix(trajectoryId: string): string{
        return `trajectory-${trajectoryId}/`;
    }

    getCachePath(trajectoryId: string, timestep: string): string{
        return path.join(this.cacheDir, trajectoryId, `${timestep}.dump`);   
    }

    async saveDump(
        trajectoryId: string,
        timestep: string,
        data: Buffer | string,
        onProgress?: (progress: number) => void
    ): Promise<string>{
        const objectName = this.getObjectName(trajectoryId, timestep);
        // Small Buffer -> Compress in RAM -> Upload
        if(Buffer.isBuffer(data) && data.length <= TrajectoryDumpStorageService.RAM_THRESHOLD){
            const compressed = zlib.gzipSync(data, {
                level: TrajectoryDumpStorageService.COMPRESSION_LEVEL
            });

            await this.storageService.upload(
                SYS_BUCKETS.DUMPS,
                objectName,
                compressed,
                {
                    'Content-Type': 'application/gzip',
                    'Content-Encoding': 'gzip'
                }
            );

            return objectName;
        }

        // Large Buffer of File Path -> Pipe Gzip stream directly to Storage.
        // this avoids creating an intermediate compressed file on disk.
        const sourceStream = typeof data === 'string'
            ? createReadStream(data)
            : Readable.from(data);
        
        let totalSize = 0;
        if(typeof data === 'string'){
            const stat = await fs.stat(data);
            totalSize = stat.size;
        }else if(Buffer.isBuffer(data)){
            totalSize = data.length;
        }

        // Monitor input stream progress
        if(onProgress){
            let processedBytes = 0;
            sourceStream.on('data', (chunk: Buffer | string) => {
                processedBytes += chunk.length;
                const percentage = Math.min(1, processedBytes / totalSize);
                onProgress(percentage);
            });
        }

        const gzip = zlib.createGzip({
            level: TrajectoryDumpStorageService.COMPRESSION_LEVEL
        });

        // Pipe source -> gzip -> storage service
        const uploadStream = sourceStream.pipe(gzip);
        await this.storageService.upload(
            SYS_BUCKETS.DUMPS,
            objectName,
            uploadStream,
            {
                'Content-Type': 'application/gzip',
                'Content-Encoding': 'gzip'
            }
        );

        return objectName;
    }

    async getDump(
        trajectoryId: string,
        timestep: string
    ): Promise<string | null>{
        const objectName = this.getObjectName(trajectoryId, timestep);
        const cachePath = this.getCachePath(trajectoryId, timestep);
        const cacheKey = `${trajectoryId}:${timestep}`;

        // Check valid cache on disk
        if(await this.isCacheValid(cachePath)){
            // Update access time
            fs.utimes(cachePath, new Date(), new Date());
            return cachePath;
        }

        // Check if already downloading (promise locking)
        if(this.pendingRequests.has(cacheKey)){
            return this.pendingRequests.get(cacheKey)!;
        }

        // Start new download
        const downloadTask = this.downloadDump(objectName, cachePath, cacheKey);
        this.pendingRequests.set(cacheKey, downloadTask);
        return downloadTask;
    }

    async calculateSize(trajectoryId: string): Promise<number>{
        const prefix = this.getPrefix(trajectoryId);
        let totalSize = 0;

        const pendingTasks: Promise<number>[] = [];
        const BATCH_SIZE = 50;
        for await(const key of this.storageService.listByPrefix(SYS_BUCKETS.DUMPS, prefix)){
            if(!key.endsWith('.dump.gz')) continue;

            const task = TrajectoryDumpStorageService.storageLimit(async () => {
                try{
                    const stat = await this.storageService.getStat(SYS_BUCKETS.DUMPS, key);
                    return stat.size;
                }catch{
                    return 0;
                }
            });

            pendingTasks.push(task);

            if(pendingTasks.length >= BATCH_SIZE){
                const results = await Promise.all(pendingTasks);
                totalSize += results.reduce((acc, size) => acc + size, 0);
                pendingTasks.length = 0;
            }
        }

        if(pendingTasks.length > 0){
            const results = await Promise.all(pendingTasks);
            totalSize += results.reduce((acc, size) => acc + size, 0);
        }

        return totalSize;
    }

    private async downloadDump(
        objectName: string,
        cachePath: string,
        cacheKey: string
    ): Promise<string | null>{
        try{
            const exists = await this.storageService.exists(
                SYS_BUCKETS.DUMPS,
                objectName
            );

            if(!exists) return null;

            const cacheDir = path.dirname(cachePath);
            await this.tempFileService.ensureDir(cacheDir);

            const remoteStream = await this.storageService.getStream(
                SYS_BUCKETS.DUMPS,
                objectName
            );

            // Stream Pipeline: Remote -> Decompress -> Disk
            const gunzip = zlib.createGunzip();
            const fileWriter = createWriteStream(cachePath);

            await pipeline(remoteStream, gunzip, fileWriter);

            return cachePath;
        }catch(error: any){
            await fs.unlink(cachePath).catch(() => {});
            logger.error(`@trajectory-dump-storage-service: error downloading ${objectName}:`, error);

            return null;
        }finally{
            // Unlock
            this.pendingRequests.delete(cacheKey);
        }
    }

    async getDumpStream(
        trajectoryId: string,
        timestep: string
    ): Promise<Readable>{
        const cachePath = this.getCachePath(trajectoryId, timestep);
        if(await this.isCacheValid(cachePath)){
            fs.utimes(cachePath, new Date(), new Date()).catch(() => {});
            return createReadStream(cachePath);
        }

        const localPath = await this.getDump(trajectoryId, timestep);
        if(!localPath){
            throw new Error(`Dump not found: trajectoryId=${trajectoryId}, timestep=${timestep}`);
        }

        return createReadStream(localPath);
    }

    async listDumps(trajectoryId: string): Promise<string[]>{
        const prefix = this.getPrefix(trajectoryId);
        const timesteps: string[] = [];
        
        logger.info(`@trajectory-dump-storage-service: Listing dumps with prefix: ${prefix} in bucket: ${SYS_BUCKETS.DUMPS}`);
        for await(const name of this.storageService.listByPrefix(SYS_BUCKETS.DUMPS, prefix)){
            const match = name.match(/timestep-(\d+)\.dump\.gz$/);
            if(!match) continue;
            timesteps.push(match[1]);
        }

        logger.info(`@trajectory-dump-storage-service: Found ${timesteps.length} dumps for trajectory ${trajectoryId}`);
        return timesteps.sort((a, b) => Number(a) - Number(b));
    }

    async deleteDumps(trajectoryId: string): Promise<void>{
        const prefix = this.getPrefix(trajectoryId);
        await Promise.all([
            this.storageService.deleteByPrefix(SYS_BUCKETS.DUMPS, prefix),
            fs.rm(path.join(this.cacheDir, trajectoryId), { recursive: true, force: true })
        ]);
        logger.info(`@trajectory-dump-storage-service: deleted dumps for trajectory ${trajectoryId}`);
    }

    private async isCacheValid(filePath: string): Promise<boolean>{
        try{
            const stats = await fs.stat(filePath);
            return (Date.now() - stats.mtimeMs) < TrajectoryDumpStorageService.CACHE_TTL_MS;
        }catch{
            return false;
        }
    }
};