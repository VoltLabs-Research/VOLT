import { ITrajectory } from '@/types/models/trajectory';
import { RasterizerOptions } from './export/rasterizer';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { getRasterizerQueue } from '@/queues';
import { Response } from 'express';
import { v4 } from 'uuid';
import storage from '@/services/storage';
import * as path from 'node:path';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';
import tempFileManager from '@/services/temp-file-manager';

export const rasterizeGLBs = async (
    prefix: string,
    prefixBucketName: string,
    bucketName: string,
    trajectory: ITrajectory,
    opts: Partial<RasterizerOptions> = {},
    analysisId?: string,
    jobName?: string
): Promise<void> => {
    const jobs: RasterizerJob[] = [];
    const CONCURRENCY_LIMIT = 10;
    const pendingTasks: Promise<void>[] = [];

    // GLBs in these paths should NOT be rasterized (they are interactive/UI-specific)
    const EXCLUDED_PATH_SEGMENTS = ['/color-coding/', '/particle-filter/'];

    for await (const key of storage.listByPrefix(prefixBucketName, prefix)) {
        const filename = key.split('/').pop();
        if (!filename || !filename.endsWith('.glb')) continue;

        // Skip color-coding and particle-filter GLBs
        if (EXCLUDED_PATH_SEGMENTS.some(seg => key.includes(seg))) continue;

        // Extract model name from filename (e.g., "dislocations.glb" -> "dislocations")
        const modelName = path.basename(filename, '.glb');
        
        // Extract timestep from path: .../glb/{timestep}/{model}.glb or timestep-{ts}.glb
        const parts = key.split('/');
        let timestep: number;
        
        // Check if path contains /glb/{timestep}/ pattern
        const glbIdx = parts.indexOf('glb');
        if (glbIdx !== -1 && parts.length > glbIdx + 1) {
            timestep = parseInt(parts[glbIdx + 1], 10);
        } else {
            // Fallback: extract from filename like "timestep-0.glb"
            const match = modelName.match(/\d+/g);
            if (!match) {
                logger.warn(`No timestep found in filename: ${filename}`);
                continue;
            }
            timestep = Number(match[match.length - 1]);
        }

        if (!Number.isFinite(timestep)) {
            logger.warn(`Invalid timestep parsed: ${filename}`);
            continue;
        }

        const task = async () => {
            try {
                const tempPath = tempFileManager.generateFilePath({ 
                    prefix: `glb_${timestep}_`, 
                    extension: '.glb' 
                });

                await storage.download(prefixBucketName, key, tempPath);
                
                // Determine if this is a base preview or an analysis model
                const isBasePreview = !analysisId || modelName.startsWith('timestep-');
                
                // Determine job name based on context
                const name = isBasePreview 
                    ? 'Generate Preview' 
                    : (jobName || `Preview for ${modelName}`);

                jobs.push({
                    jobId: v4(),
                    trajectoryId: trajectory._id.toString(),
                    trajectoryName: trajectory.name,
                    teamId: trajectory.team._id.toString(),
                    timestep,
                    analysisId: isBasePreview ? undefined : analysisId,
                    model: isBasePreview ? undefined : modelName,
                    name,
                    message: trajectory.name,
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
