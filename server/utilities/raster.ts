import { ITrajectory } from '@/types/models/trajectory';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { listByPrefix, downloadObject } from '@/utilities/buckets';
import { createTempDir } from '@/utilities/runtime';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { getRasterizerQueue } from '@/queues';
import { v4 } from 'uuid';
import * as path from 'node:path';

export const rasterizeGLBs = async (
    prefix: string, 
    bucketName: string,
    trajectory: ITrajectory,
    opts: Partial<HeadlessRasterizerOptions> = {}
): Promise<void> => {
    const jobs: RasterizerJob[] = [];
    const keys = await listByPrefix(prefix, bucketName);
    
    const promises = keys.map(async (key) => {
        const filename = key.split('/').pop();
        if(!filename) return;
        
        const timestep = path.basename(filename, '.glb');
        const tempDir = await createTempDir();
        const tempPath = path.join(tempDir, timestep);
        await downloadObject(key, bucketName, tempPath);

        jobs.push({
            jobId: v4(),
            trajectoryId: trajectory._id.toString(),
            teamId: trajectory.team._id.toString(),
            timestep: Number(timestep),
            name: 'Headless Rasterizer (Preview)',
            message: `${trajectory.name} - Preview frame ${timestep}`,
            opts: {
                inputPath: tempPath,
                ...opts
            }
        });
    });

    await Promise.all(promises);

    const queueService = getRasterizerQueue();
    queueService.addJobs(jobs);
};
