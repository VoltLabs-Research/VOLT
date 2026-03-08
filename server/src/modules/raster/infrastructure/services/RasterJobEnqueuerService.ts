import { inject, injectable } from 'tsyringe';
import { v4 } from 'uuid';
import { ErrorCodes } from '@core/constants/error-codes';
import type { IRasterJobEnqueuer } from '@modules/raster/domain/port/IRasterJobEnqueuer';
import type { IRasterStorage } from '@modules/raster/domain/port/IRasterStorage';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import RasterizerQueue from '@modules/raster/infrastructure/queues/RasterizerQueue';
import { parseRasterTimestep } from '@modules/raster/infrastructure/services/raster-storage-paths';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';

@injectable()
export class RasterJobEnqueuerService implements IRasterJobEnqueuer {
    constructor(
        @inject(RASTER_TOKENS.RasterStorage)
        private readonly rasterStorage: IRasterStorage,

        @inject(RASTER_TOKENS.RasterizerQueue)
        private readonly rasterizerQueue: RasterizerQueue
    ){}

    async triggerRasterization(trajectoryId: string, teamId: string, _config?: unknown): Promise<boolean> {
        const glbFiles: string[] = [];

        try {
            for await (const file of this.rasterStorage.listModelFiles(trajectoryId)) {
                if (file.endsWith('.glb')) {
                    glbFiles.push(file);
                }
            }
        } catch (error) {
            logger.warn(error, `Failed to list GLB files for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to list GLB files for rasterization',
                500
            );
        }

        if (glbFiles.length === 0) {
            return false;
        }

        const jobs: Job[] = [];

        for (const fileKey of glbFiles) {
            const timestep = parseRasterTimestep(fileKey);

            if (timestep === null) {
                continue;
            }

            jobs.push(Job.create({
                jobId: v4(),
                teamId,
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

        if (jobs.length === 0) {
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to derive rasterization jobs from GLB files',
                500
            );
        }

        try {
            await this.rasterizerQueue.addJobs(jobs);
            return true;
        } catch (error) {
            logger.warn(error, `Failed to queue rasterization jobs for trajectory ${trajectoryId}`);
            throw new ApplicationError(
                ErrorCodes.RASTER_FAILED,
                'Failed to queue rasterization jobs',
                500
            );
        }
    }
}
