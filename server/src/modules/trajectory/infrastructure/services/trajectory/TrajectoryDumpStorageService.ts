import { SYS_BUCKETS } from '@core/config/minio';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { ITempFileService } from '@shared/domain/port/ITempFileService';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';

import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { injectable, inject } from 'tsyringe';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

@injectable()
export default class TrajectoryDumpStorageService implements ITrajectoryDumpStorageService{
    private static readonly CACHE_TTL_MS = 30 * 60 * 1000;
    private readonly cacheDir: string;
    private readonly pendingRequests = new Map<string, Promise<string | null>>();

    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TempFileService)
        private readonly tempFileService: ITempFileService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
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

    async existsDump(trajectoryId: string, timestep: string): Promise<boolean> {
        const objectName = this.getObjectName(trajectoryId, timestep);
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);

        if (trajectory?.props.teamCluster) {
            const result = await this.teamClusterDaemonClient.command<{ keys: string[] }>(
                trajectory.props.teamCluster,
                TEAM_CLUSTER_DAEMON_COMMAND.object.list,
                { bucket: SYS_BUCKETS.DUMPS, prefix: objectName }
            );
            return result.keys.includes(objectName);
        }

        return this.storageService.exists(SYS_BUCKETS.DUMPS, objectName);
    }

    async listDumps(trajectoryId: string): Promise<string[]>{
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        if(trajectory?.props.teamCluster){
            return this.listDumpsFromDaemon(trajectory.props.teamCluster, trajectoryId);
        }

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

    private async listDumpsFromDaemon(teamClusterId: string, trajectoryId: string): Promise<string[]>{
        const prefix = this.getPrefix(trajectoryId);
        logger.info(`@trajectory-dump-storage-service: Listing dumps from daemon for trajectory ${trajectoryId} (cluster: ${teamClusterId})`);

        const result = await this.teamClusterDaemonClient.command<{ keys: string[] }>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.object.list,
            { bucket: SYS_BUCKETS.DUMPS, prefix }
        );

        const timesteps: string[] = [];
        for(const name of result.keys){
            const match = name.match(/timestep-(\d+)\.dump\.gz$/);
            if(!match) continue;
            timesteps.push(match[1]);
        }

        logger.info(`@trajectory-dump-storage-service: Found ${timesteps.length} dumps from daemon for trajectory ${trajectoryId}`);
        return timesteps.sort((a, b) => Number(a) - Number(b));
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
