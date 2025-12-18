import { ITrajectory } from '@/types/models/trajectory';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { createTempDir } from '@/utilities/runtime/runtime';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { getRasterizerQueue } from '@/queues';
import { Response } from 'express';
import { v4 } from 'uuid';
import storage from '@/services/storage';
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
    const CONCURRENCY_LIMIT = 10;
    const pendingTasks: Promise<void>[] = [];

    for await (const key of storage.listByPrefix(prefixBucketName, prefix)) {
        const filename = key.split('/').pop();
        if (!filename) continue;

        const base = path.basename(filename, '.glb');
        const match = base.match(/\d+/g);

        if (!match) {
            logger.warn(`No timestep found in filename: ${filename}`);
            continue;
        }

        const timestep = Number(match[match.length - 1]);
        if (Number.isNaN(timestep)) {
            logger.warn(`Invalid timestep parsed: ${filename}`);
            continue;
        }

        const task = async () => {
            try {
                // Create unique temp dir for this specific frame
                const tempDir = await createTempDir();
                const tempPath = path.join(tempDir, timestep.toString());

                await storage.download(prefixBucketName, key, tempPath);
                jobs.push({
                    jobId: v4(),
                    trajectoryId: trajectory._id.toString(),
                    teamId: trajectory.team._id.toString(),
                    timestep,
                    name: 'Headless Rasterizer(Preview)',
                    message: `${trajectory.name} - Preview frame ${timestep}`,
                    opts: {
                        inputPath: tempPath,
                        ...opts
                    }
                });
            } catch (error) {
                logger.error(`Failed to process frame ${timestep} from key ${key}: ${error}`);
            }
        };

        pendingTasks.push(task());
        // If the bucket is full, wait for these 10 downloads to finish before taking more
        if (pendingTasks.length >= CONCURRENCY_LIMIT) {
            await Promise.all(pendingTasks);
            // Immediately free memory references
            pendingTasks.length = 0;
        }
    }

    // Finish any remaining tasks that didn't fill a complete batch
    if (pendingTasks.length > 0) {
        await Promise.all(pendingTasks);
    }

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

/**
 * Get any available rasterized preview for a trajectory.
 * This finds the first available preview PNG in storage, regardless of timestep.
 * This is more robust because we don't know which frame was processed first.
 */
export const getAnyTrajectoryPreview = async (
    trajectoryId: string
): Promise<{ buffer: Buffer, etag: string } | null> => {
    const prefix = `trajectory-${trajectoryId}/previews/`;

    // Find the first available preview
    for await (const key of storage.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
        if (key.endsWith('.png')) {
            try {
                const buffer = await storage.getBuffer(SYS_BUCKETS.RASTERIZER, key);
                const etag = `"trajectory-preview-${trajectoryId}"`;
                return { buffer, etag };
            } catch (error) {
                logger.warn(`Failed to get preview ${key}: ${error}`);
                // Continue to next preview if this one fails
            }
        }
    }

    return null;
};

/**
 * Get a specific timestep's rasterized preview.
 * Used when the user explicitly requests a specific frame's preview.
 */
export const getTimestepPreview = async (
    trajectoryId: string,
    timestep: number
): Promise<{ buffer: Buffer, etag: string }> => {
    const objectName = `trajectory-${trajectoryId}/previews/timestep-${timestep}.png`;
    const buffer = await storage.getBuffer(SYS_BUCKETS.RASTERIZER, objectName);
    const etag = `"trajectory-preview-${trajectoryId}"`;
    return { buffer, etag };
};
