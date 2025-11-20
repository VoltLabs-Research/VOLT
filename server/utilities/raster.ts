import { ITrajectory } from '@/types/models/trajectory';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { listByPrefix, downloadObject, getObject } from '@/utilities/buckets';
import { createTempDir } from '@/utilities/runtime';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { getRasterizerQueue } from '@/queues';
import { Response } from 'express';
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

export const sendImage = (res: Response, etag: string, buffer: Buffer) => {
    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', etag);
    return res.status(200).json({
        status: 'success',
        data: base64
    })
};

export const getTimestepPreview = async (
    trajectoryId: string, 
    timestep: number
): Promise<{ buffer: Buffer, etag: string }> => {
    const objectName = `${trajectoryId}/previews/raster/${timestep}.png`;
    const buffer = await getObject(objectName, 'raster');
    const etag = `"trajectory-preview-${trajectoryId}"`;
    return { buffer, etag };
};