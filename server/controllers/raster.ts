import { Request, Response } from 'express';
import { readdir } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { getRasterizerQueue } from '@/queues';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { buildRasterItems, buildAnalyses } from '@/services/headless-rasterizer';
import { parseFrame } from '@/utilities/raster';
import { listGlbFiles } from '@/utilities/fs';
import { catchAsync } from '@/utilities/runtime';
import { v4 } from 'uuid';

export const rasterizeFrames = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const glbDir = join(basePath, trajectory.folderId, 'glb');
    const outputDir = join(basePath, trajectory.folderId, 'raster');
    const glbs = listGlbFiles(glbDir);
    const customOpts: Partial<HeadlessRasterizerOptions> = req.body;

    const jobs: RasterizerJob[] = (await glbs).map((glbPath) => {
        const frame = basename(glbPath).replace(/\.[^.]+$/i, '');
        const outPath = join(outputDir, `${frame}.png`);
        const opts: Partial<HeadlessRasterizerOptions> = {
            inputPath: glbPath,
            outputPath: outPath,
            ...customOpts
        };

        const job = {
            opts,
            jobId: v4(),
            trajectoryId: trajectory._id,
            teamId: trajectory.team._id,
            name: 'Headless Rasterizer',
            message: `${trajectory.name} - Frame ${frame}`
        };

        return job;
    });

    const queueService= getRasterizerQueue();
    queueService.addJobs(jobs);
    
    res.status(200).json({ status: 'success' });
});

export const getRasterizedFrames = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const rasterDir = join(basePath, trajectory.folderId, 'raster');
    const glbDir = join(basePath, trajectory.folderId, 'glb');

    const allFiles = await readdir(rasterDir);
    const pngs = allFiles.filter((file) => file.toLowerCase().endsWith('.png'));
    const pngSet = new Set(pngs.map((file) => file.toLowerCase()));

    pngs.sort((a, b) => {
        const fa = parseFrame(a);
        const fb = parseFrame(b);
        if(fa !== null && fb !== null) return fa - fb;
        if(fa !== null) return -1;
        if(fb !== null) return 1;
        return a.localeCompare(b, undefined, { numeric: true });
    });

    const total = pngs.length;
    const items = await buildRasterItems(rasterDir, pngs);
  
    const glbs = (await readdir(glbDir)).filter((file) => file.toLowerCase().endsWith('.glb'));
    const byFrame = await buildAnalyses(rasterDir, glbs, pngSet, trajectory._id);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"raster-${trajectory._id}-${total}"`);

    return res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            items,
            byFrame,
            total
        }
    })
};