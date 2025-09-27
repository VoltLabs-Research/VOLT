import { Request, Response } from 'express';
import { join, resolve, basename } from 'path';
import { getRasterizerQueue } from '@/queues';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { listGlbFiles } from '@/utilities/fs';
import { catchAsync } from '@/utilities/runtime';
import { readFile } from 'fs/promises';;
import { v4 } from 'uuid';
import { readdir } from 'fs/promises';
import { AnalysisConfig, Trajectory } from '@/models';  
import path from 'path';
import TrajectoryFS from '@/services/trajectory-fs';
import archiver from 'archiver';

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

export const readRasterModel = async (
    modelType: string,
    analysisId: string,
    trajectoryId: string,
    frame: number
): Promise<Buffer> => {
    const trajFS = new TrajectoryFS(trajectoryId);
    const absPath = join(trajFS.root, analysisId, 'raster', String(frame), `${modelType}.png`);
    return readFile(absPath);
};

export const getRasterFrameMetadata = async (req: Request, res: Response) => {
    let trajectory = res.locals.trajectory;

    trajectory = await Trajectory.findOneAndUpdate(
        { _id: trajectory._id },
        { $inc: { rasterSceneViews: 1 } },
        { new: true }
    );

    const analyses = await AnalysisConfig
        .find({ trajectory: trajectory._id })
        .select('-createdAt -updatedAt -__v')
        .lean();

    const tfs = new TrajectoryFS(trajectory.folderId);
    const analysesMetadata: Record<string, any> = {};

    for (const analysis of analyses) {
        const id = String(analysis._id);
        const framesMeta: Record<string, any> = {};

        for (const { timestep } of trajectory.frames) {
            const types = await tfs.listRasterAnalyses(timestep, id);
            framesMeta[timestep] = {
                timestep,
                availableModels: ['preview', ...types]
            };
        }

        analysesMetadata[id] = { ...analysis, frames: framesMeta };
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('ETag', `"raster-meta-${trajectory._id}-${trajectory.rasterSceneViews}"`);

    return res.status(200).json({
        status: 'success',
        data: { trajectory, analyses: analysesMetadata }
    });
};
export const getRasterFrame = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const { timestep, analysisId, model } = req.params;
    const frameNumber = Number(timestep);

    if (!Number.isFinite(frameNumber)) {
        return res.status(400).json({ status: 'error', message: 'Invalid timestep parameter' });
    }

    try {
        const tfs = new TrajectoryFS(trajectory.folderId);
        let buffer: Buffer;

        if (model === 'preview') {
            // previews/raster/<frame>.png
            const p = path.join(tfs.root, 'previews', 'raster', `${frameNumber}.png`);
            buffer = await readFile(p);
        } else {
            buffer = await readRasterModel(model, analysisId, trajectory.folderId, frameNumber);
        }

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Length', String(buffer.length));
        res.setHeader('ETag', `"frame-${trajectory._id}-${frameNumber}-${model}-${analysisId}"`);
        return res.send(buffer);
    } catch {
        return res.status(404).json({ status: 'error', message: 'Frame not found' });
    }
};

export const getRasterFrameData = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const { timestep, analysisId, model } = req.params;
    const frameNumber = Number(timestep);

    if (!Number.isFinite(frameNumber)) {
        return res.status(400).json({ status: 'error', message: 'Invalid timestep parameter' });
    }

    try {
        const tfs = new TrajectoryFS(trajectory.folderId);
        let buffer: Buffer;

        if (model === 'preview') {
            const p = path.join(tfs.root, 'previews', 'raster', `${frameNumber}.png`);
            buffer = await readFile(p);
        } else {
            buffer = await readRasterModel(model, analysisId, trajectory.folderId, frameNumber);
        }

        const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', `"frame-data-${trajectory._id}-${frameNumber}-${model}-${analysisId}"`);

        return res.status(200).json({
            status: 'success',
            data: { model, frame: frameNumber, analysisId, data: base64 }
        });
    } catch {
        return res.status(404).json({ status: 'error', message: 'Frame not found' });
    }
};


export const getRasterizedFrames = async (req: Request, res: Response) => {
    let trajectory = res.locals.trajectory;
    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const rasterDir = join(basePath, trajectory.folderId, 'raster');

    trajectory = await Trajectory.findOneAndUpdate(
        { _id: trajectory._id }, 
        { $inc: { rasterSceneViews: 1 } },
        { new: true }
    );

    const analyses = await AnalysisConfig
        .find({ trajectory: trajectory._id })
        .select('-createdAt -updatedAt -__v')
        .lean();

    const analysesData: Record<string, any> = {};
    const trajFS = new TrajectoryFS(trajectory.folderId);

    for(const analysis of analyses){
        const id = analysis._id.toString();
        const data: Record<string, any> = {
            ...analysis,
            frames: {}
        };

        for(const { timestep } of trajectory.frames){
            const models: Record<string, any> = {};
            const availableModels = await trajFS.listRasterAnalyses(timestep, id);

            for(const model of availableModels){
                const buffer = await readRasterModel(model, id, rasterDir, timestep);
                models[model] = {
                    model,
                    frame: timestep,
                    analysisId: id,
                    data: `data:image/png;base64,${buffer.toString('base64')}`
                };
            }

            const previewBuffer = await readFile(join(rasterDir, `${timestep}.png`));
            models['preview'] = {
                model: 'preview',
                frame: timestep,
                analysisId: id,
                data: `data:image/png;base64,${previewBuffer.toString('base64')}`
            }

            data.frames[timestep] = models;
        }

        analysesData[id] = data;
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    res.setHeader('Vary', 'Authorization');
    const etagBase = `raster-${trajectory._id}-${trajectory.rasterSceneViews}-${trajectory.frames?.length ?? 0}`;
    res.setHeader('ETag', `"${etagBase}"`);

    return res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            analyses: analysesData
        }
    })
    };

export const downloadRasterImagesArchive = async (req: Request, res: Response) => {
    const trajectory = res.locals?.trajectory;
    const { analysisId, model, includePreview } = req.query as {
        analysisId?: string;
        model?: string;
        includePreview?: string;
    };

    if (!trajectory) {
        return res.status(400).json({ status: 'error', data: { error: 'Trajectory not found' } });
    }

    try {
        const tfs = new TrajectoryFS(trajectory.folderId);
        const wantPreview = includePreview === '1' || includePreview === 'true';
        const files: string[] = [];

        if (wantPreview) {
            const prevDir = join(tfs.root, 'previews', 'raster');
            try {
                const prevs = await readdir(prevDir, { withFileTypes: true });
                for (const e of prevs) {
                    if (e.isFile() && e.name.endsWith('.png')) {
                        files.push(join(prevDir, e.name));
                    }
                }
            } catch {/* ignore */}
        }

        if (analysisId) {
            const analysisRasterRoot = join(tfs.root, analysisId, 'raster');
            try {
                const frames = await readdir(analysisRasterRoot, { withFileTypes: true });
                for (const f of frames) {
                    if (!f.isDirectory()) continue;
                    const frameDir = join(analysisRasterRoot, f.name);
                    const pngs = await readdir(frameDir, { withFileTypes: true });
                    for (const p of pngs) {
                        if (!p.isFile() || !p.name.endsWith('.png')) continue;
                        if (model && p.name !== `${model}.png`) continue;
                        files.push(join(frameDir, p.name));
                    }
                }
            } catch {/* ignore */}
        }

        if (!files.length) {
            return res.status(404).json({
                status: 'error',
                data: { error: 'No raster images found with the given filters' }
            });
        }

        const filenameSafe = String(trajectory.name || trajectory._id).replace(/[^a-z0-9_\-]+/gi, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameSafe}_raster_images.zip"`);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const archive = archiver('zip', { zlib: { level: 0 } });

        archive.on('warning', (err) => console.warn('archiver warning:', err));
        archive.on('error', (err) => {
            console.error('archiver error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    status: 'error',
                    data: { error: 'Failed to build raster images archive' }
                });
            } else {
                try { res.end(); } catch {}
            }
        });

        archive.pipe(res);
        files.sort((a, b) => a.localeCompare(b));
        for (const abs of files) {
            // Conservamos la estructura relativa básica en el zip
            const rel = abs.split(trajectory.folderId).pop()!.replace(/^[/\\]/, '');
            archive.file(abs, { name: rel });
        }
        await archive.finalize();
    } catch (err) {
        console.error('downloadRasterImagesArchive error:', err);
        if (!res.headersSent) {
            return res.status(500).json({
                status: 'error',
                data: { error: 'Failed to build raster images archive' }
            });
        }
        try { res.end(); } catch {}
    }
};