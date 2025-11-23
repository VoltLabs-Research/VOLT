import { ITrajectory } from '@/types/models/trajectory';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { listByPrefix, downloadObject, getObject } from '@/utilities/buckets';
import { createTempDir } from '@/utilities/runtime';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { getRasterizerQueue } from '@/queues';
import { Response } from 'express';
import { v4 } from 'uuid';
import * as path from 'node:path';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

export const rasterizeGLBs = async (
    prefix: string,
    prefixBucketName: string,
    bucketName: string,
    trajectory: ITrajectory,
    opts: Partial<HeadlessRasterizerOptions> = {}
): Promise<void> => {
    const jobs: RasterizerJob[] = [];
    const keys = await listByPrefix(prefix, prefixBucketName);

    const promises = keys.map(async (key) => {
        const filename = key.split('/').pop();
        if (!filename) return;

        const base = path.basename(filename, '.glb');
        const match = base.match(/\d+/g);
        if (!match) {
            logger.warn(`No timestep found in filename: ${filename}`);
            return;
        }

        const timestep = Number(match[match.length - 1]);
        if (Number.isNaN(timestep)) {
            logger.warn(`Invalid timestep parsed from filename: ${filename}`);
            return;
        }

        const tempDir = await createTempDir();
        const tempPath = path.join(tempDir, timestep.toString());
        await downloadObject(key, prefixBucketName, tempPath);

        jobs.push({
            jobId: v4(),
            trajectoryId: trajectory._id.toString(),
            teamId: trajectory.team._id.toString(),
            timestep,
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
    const objectName = `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;
    const buffer = await getObject(objectName, SYS_BUCKETS.RASTERIZER);
    const etag = `"trajectory-preview-${trajectoryId}"`;
    return { buffer, etag };
};