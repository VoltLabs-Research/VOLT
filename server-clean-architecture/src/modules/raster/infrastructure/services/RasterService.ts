import { injectable, inject } from 'tsyringe';
import { IRasterService, RasterMetadata } from '../../domain/ports/IRasterService';
import { RASTER_TOKENS } from '../di/RasterTokens';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@/src/shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@/src/core/minio';
import RasterizerQueue from '../queues/RasterizerQueue';
import Job, { JobStatus } from '@/src/modules/jobs/domain/entities/Job';
import { v4 } from 'uuid';
import path from 'path';

@injectable()
export class RasterService implements IRasterService {
    constructor(
        @inject(RASTER_TOKENS.RasterizerQueue)
        private readonly rasterizerQueue: RasterizerQueue,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) { }

    async triggerRasterization(trajectoryId: string, teamId: string, config?: any): Promise<boolean> {
        const prefix = `trajectory-${trajectoryId}/`;
        const glbFiles: string[] = [];

        try {
            for await (const file of this.storageService.listByPrefix(SYS_BUCKETS.MODELS, prefix)) {
                if (file.endsWith('.glb')) {
                    glbFiles.push(file);
                }
            }
        } catch (error) {
            // Silent catch
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
        return Promise.resolve(null);
    }

    async getRasterFramePNG(trajectoryId: string, timestep: number): Promise<Buffer> {
        throw new Error("Method not implemented.");
    }
}
