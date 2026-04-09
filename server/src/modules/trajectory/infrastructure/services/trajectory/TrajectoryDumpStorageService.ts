import { SYS_BUCKETS } from '@core/config/minio';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import {
    buildTrajectoryDumpObjectName,
    createZstdDecompressionStream
} from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { ITempFileService } from '@shared/domain/port/ITempFileService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { createReadStream, createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { injectable, inject } from 'tsyringe';
import fs from 'node:fs/promises';
import path from 'node:path';

@injectable()
export default class TrajectoryDumpStorageService implements ITrajectoryDumpStorageService {
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

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {
        this.cacheDir = this.tempFileService.getDirPath('trajectory-cache');
    }

    getObjectName(trajectoryId: string, timestep: string): string {
        return buildTrajectoryDumpObjectName(trajectoryId, timestep);
    }

    getPrefix(trajectoryId: string): string {
        return `trajectory-${trajectoryId}/`;
    }

    getCachePath(trajectoryId: string, timestep: string): string {
        return path.join(this.cacheDir, trajectoryId, `${timestep}.dump`);
    }

    async getDump(trajectoryId: string, timestep: string): Promise<string | null> {
        const cachePath = this.getCachePath(trajectoryId, timestep);
        const cacheKey = `${trajectoryId}:${timestep}`;
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        if (await this.isCacheValid(cachePath)) {
            fs.utimes(cachePath, new Date(), new Date()).catch(() => {});
            return cachePath;
        }

        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey)!;
        }

        const downloadTask = this.downloadDump(trajectoryId, timestep, cachePath, cacheKey, storageClusterId);
        this.pendingRequests.set(cacheKey, downloadTask);
        return downloadTask;
    }

    private async downloadDump(
        trajectoryId: string,
        timestep: string,
        cachePath: string,
        cacheKey: string,
        storageClusterId?: string
    ): Promise<string | null> {
        try {
            const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);

            await this.tempFileService.ensureDir(path.dirname(cachePath));

            const remoteStream = storageClusterId
                ? (await this.objectGatewayClient.getStream(storageClusterId, SYS_BUCKETS.DUMPS, objectName)).stream
                : await this.storageService.getStream(SYS_BUCKETS.DUMPS, objectName);

            const fileWriter = createWriteStream(cachePath);
            const decompressed = createZstdDecompressionStream(remoteStream);
            await pipeline(decompressed.stream, fileWriter);
            await decompressed.completion;

            return cachePath;
        } catch (error) {
            await fs.unlink(cachePath).catch(() => {});
            logger.error(
                { err: error },
                `@trajectory-dump-storage-service: error downloading trajectory=${trajectoryId} timestep=${timestep}`
            );
            return null;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    async getDumpStream(trajectoryId: string, timestep: string): Promise<Readable> {
        const cachePath = this.getCachePath(trajectoryId, timestep);
        if (await this.isCacheValid(cachePath)) {
            fs.utimes(cachePath, new Date(), new Date()).catch(() => {});
            return createReadStream(cachePath);
        }

        const localPath = await this.getDump(trajectoryId, timestep);
        if (!localPath) {
            throw new Error(`Dump not found: trajectoryId=${trajectoryId}, timestep=${timestep}`);
        }

        return createReadStream(localPath);
    }

    async existsDump(trajectoryId: string, timestep: string): Promise<boolean> {
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;
        const objectName = buildTrajectoryDumpObjectName(trajectoryId, timestep);

        return storageClusterId
            ? this.objectGatewayClient.exists(storageClusterId, SYS_BUCKETS.DUMPS, objectName)
            : this.storageService.exists(SYS_BUCKETS.DUMPS, objectName);
    }

    async listDumps(trajectoryId: string): Promise<string[]> {
        const trajectory = await this.trajectoryRepo.findById(trajectoryId);
        const storageClusterId = trajectory
            ? resolveTrajectoryStorageClusterId(trajectory.props)
            : undefined;

        const prefix = this.getPrefix(trajectoryId);
        const timesteps = new Set<string>();
        const source = storageClusterId
            ? this.objectGatewayClient.listAll(storageClusterId, {
                bucket: SYS_BUCKETS.DUMPS,
                prefix
            })
            : this.storageService.listByPrefix(SYS_BUCKETS.DUMPS, prefix);

        for await (const name of source) {
            const match = name.match(/timestep-(\d+)\.dump\.zst$/);
            if (!match) continue;
            timesteps.add(match[1]);
        }

        return Array.from(timesteps).sort((a, b) => Number(a) - Number(b));
    }

    private async isCacheValid(filePath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(filePath);
            return (Date.now() - stats.mtimeMs) < TrajectoryDumpStorageService.CACHE_TTL_MS;
        } catch {
            return false;
        }
    }
}
