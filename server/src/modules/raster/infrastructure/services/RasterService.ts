import { injectable, inject } from 'tsyringe';
import { IRasterService, RasterMetadata } from '@modules/raster/domain/port/IRasterService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/port/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import RasterizerQueue from '@modules/raster/infrastructure/queues/RasterizerQueue';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { v4 } from 'uuid';
import path from 'path';
import logger from '@shared/infrastructure/logger';

@injectable()
export class RasterService implements IRasterService {
    constructor(
        @inject(RASTER_TOKENS.RasterizerQueue)
        private readonly rasterizerQueue: RasterizerQueue,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ){}

    async triggerRasterization(trajectoryId: string, teamId: string, _config?: any): Promise<boolean> {
        const prefix = `trajectory-${trajectoryId}/`;
        const glbFiles: string[] = [];

        try {
            for await (const file of this.storageService.listByPrefix(SYS_BUCKETS.MODELS, prefix)) {
                if (file.endsWith('.glb')) {
                    glbFiles.push(file);
                }
            }
        } catch (error) {
            logger.warn(error, 'Failed to list existing rasters');
        }

        if (glbFiles.length === 0) {
            return false;
        }

        const jobs: Job[] = [];

        for (const fileKey of glbFiles) {
            const basename = path.basename(fileKey, '.glb');
            // format usually: something-number.glb
            const match = basename.match(/(\d+)/);
            if (!match) continue;

            const timestep = parseInt(match[0], 10);
            if (isNaN(timestep)) continue;

            const jobId = v4();
            jobs.push(Job.create({
                jobId,
                teamId: teamId,
                queueType: 'rasterizer',
                status: JobStatus.Queued,
                metadata: {
                    trajectoryId,
                    timestep,
                    storageKey: fileKey,
                    width: 1600,
                    height: 900
                }
            }));
        }

        if (jobs.length > 0) {
            await this.rasterizerQueue.addJobs(jobs);
            return true;
        }

        return false; // No jobs created
    }

    async getRasterMetadata(trajectoryId: string): Promise<RasterMetadata | null> {
        const prefix = `trajectory-${trajectoryId}/previews/`;
        let rasterizedFrames = 0;

        try {
            for await (const file of this.storageService.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
                if (file.endsWith('.png')) {
                    rasterizedFrames++;
                }
            }
        } catch (error) {
            logger.warn(error, `Failed to list raster previews for trajectory ${trajectoryId}`);
            return null;
        }

        if (rasterizedFrames === 0) {
            return null;
        }

        const glbPrefix = `trajectory-${trajectoryId}/`;
        let totalFrames = 0;

        try {
            for await (const file of this.storageService.listByPrefix(SYS_BUCKETS.MODELS, glbPrefix)) {
                if (file.endsWith('.glb')) {
                    totalFrames++;
                }
            }
        } catch (error) {
            logger.warn(error, `Failed to list GLB models for trajectory ${trajectoryId}`);
        }

        const status = rasterizedFrames >= totalFrames && totalFrames > 0 ? 'completed' : 'processing';

        return {
            trajectoryId,
            totalFrames,
            rasterizedFrames,
            status,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    async getRasterFramePNG(trajectoryId: string, timestep: number): Promise<Buffer> {
        const objectName = `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;

        try {
            const exists = await this.storageService.exists(SYS_BUCKETS.RASTERIZER, objectName);
            if (!exists) {
                throw new Error(`Raster frame not found: trajectory=${trajectoryId}, timestep=${timestep}`);
            }
            return await this.storageService.getBuffer(SYS_BUCKETS.RASTERIZER, objectName);
        } catch (error: any) {
            logger.warn(error, `Failed to retrieve raster frame PNG for trajectory ${trajectoryId}, timestep ${timestep}`);
            throw error;
        }
    }
}
