import { Request, Response } from 'express';
import { join, resolve, basename } from 'path';
import { getRasterizerQueue } from '@/queues';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { listGlbFiles } from '@/utilities/fs';
import { catchAsync } from '@/utilities/runtime';
import { readFile } from 'fs/promises';;
import { v4 } from 'uuid';
import { listRasterModels } from '@/utilities/raster';
import { readdir } from 'fs/promises';
import { AnalysisConfig, Trajectory } from '@/models';
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

export const readRasterModel = async (modelType: string,  analysisId: string, rasterDir: string, frame: number): Promise<Buffer> => {
    const filename = `frame-${frame}_${modelType}_analysis-${analysisId}.png`;
    const absPath = join(rasterDir, filename);
    const buffer = await readFile(absPath);
    return buffer;
};

export const getRasterFrameMetadata = async (req: Request, res: Response) => {
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

    const analysesMetadata: Record<string, any> = {};

    for(const analysis of analyses){
        const id = analysis._id.toString();
        const frameMetadata: Record<string, any> = {};
        
        for(const { timestep } of trajectory.frames){
            const availableModels = await listRasterModels(rasterDir, timestep, id);
            frameMetadata[timestep] = {
                timestep,
                availableModels: ['preview', ...availableModels]
            };
        }

        analysesMetadata[id] = {
            ...analysis,
            frames: frameMetadata
        };
    }

    // Prevent caching so the view counter and metadata are always fresh
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    // Ensure caches consider auth state and changing state; include views in ETag
    res.setHeader('Vary', 'Authorization');
    res.setHeader('ETag', `"raster-meta-${trajectory._id}-${trajectory.rasterSceneViews}"`);

    return res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            analyses: analysesMetadata
        }
    });
};

export const getRasterFrame = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const { timestep, analysisId, model } = req.params;
    const frameNumber = parseInt(timestep, 10);
    
    if(isNaN(frameNumber)){
        return res.status(400).json({
            status: 'error',
            message: 'Invalid timestep parameter'
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const rasterDir = join(basePath, trajectory.folderId, 'raster');

    try {
        let buffer: Buffer;
        
        if(model === 'preview'){
            buffer = await readFile(join(rasterDir, `${frameNumber}.png`));
        } else {
            buffer = await readRasterModel(model, analysisId, rasterDir, frameNumber);
        }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('ETag', `"frame-${trajectory._id}-${frameNumber}-${model}-${analysisId}"`);
        
        return res.send(buffer);
    } catch (error) {
        return res.status(404).json({
            status: 'error',
            message: 'Frame not found'
        });
    }
};

export const getRasterFrameData = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const { timestep, analysisId, model } = req.params;
    const frameNumber = parseInt(timestep, 10);
    
    if(isNaN(frameNumber)){
        return res.status(400).json({
            status: 'error',
            message: 'Invalid timestep parameter'
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const rasterDir = join(basePath, trajectory.folderId, 'raster');

    try {
        let buffer: Buffer;
        
        if(model === 'preview'){
            buffer = await readFile(join(rasterDir, `${frameNumber}.png`));
        } else {
            buffer = await readRasterModel(model, analysisId, rasterDir, frameNumber);
        }

        const base64Data = `data:image/png;base64,${buffer.toString('base64')}`;

        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('ETag', `"frame-data-${trajectory._id}-${frameNumber}-${model}-${analysisId}"`);
        
        return res.status(200).json({
            status: 'success',
            data: {
                model,
                frame: frameNumber,
                analysisId,
                data: base64Data
            }
        });
    } catch (error) {
        return res.status(404).json({
            status: 'error',
            message: 'Frame not found'
        });
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

    for(const analysis of analyses){
        const id = analysis._id.toString();
        const data: Record<string, any> = {
            ...analysis,
            frames: {}
        };

        for(const { timestep } of trajectory.frames){
            const models: Record<string, any> = {};
            const availableModels = await listRasterModels(rasterDir, timestep, id);

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
    // Compose a basic ETag that changes with views and frames count
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

        if(!trajectory){
            return res.status(400).json({
                status: 'error',
                data: { error: 'Trajectory not found' }
            });
        }

        const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
        const rasterDir = join(basePath, trajectory.folderId, 'raster');

        try{
            const entries = await readdir(rasterDir, { withFileTypes: true });
            const files: string[] = [];
            const wantPreview = includePreview === '1' || includePreview === 'true';
            const modelStr = model ? String(model) : undefined;
            const analysisStr = analysisId ? String(analysisId) : undefined;

            for(const entry of entries){
                if(!entry.isFile()) continue;
                if(!entry.name.endsWith('.png')) continue;

                const name = entry.name;
                // preview: "<timestep>.png"
                if(/^[0-9]+\.png$/i.test(name)){
                    if(wantPreview) files.push(join(rasterDir, name));
                    continue;
                }

                // model: "frame-<frame>_<model>_analysis-<analysisId>.png"
                const m = name.match(/^frame-(\d+)_(.+?)_analysis-([^.]+)\.png$/i);
                if(!m) continue;

                // 1 = timestep, 2 = model, 3 = analysis
                const [, , fileModel, fileAnalysis] = m;
                if(analysisStr && fileAnalysis !== analysisStr) continue;
                if(modelStr && fileModel !== modelStr) continue;
                files.push(join(rasterDir, name));
            }

            if(!files.length){
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
        
            archive.on('warning', (err: any) => {
                console.warn('archiver warning:', err);
            });

            archive.on('error', (err: any) => {
                console.error('archiver error:', err);
                if(!res.headersSent){
                    res.status(500).json({
                        status: 'error',
                        data: { error: 'Failed to build raster images archive' }
                    });
                }else{
                    try{
                        res.end();
                    }catch{}
                }
            });

            archive.pipe(res);

            files.sort((a, b) => a.localeCompare(b));
            for(const abs of files){
                archive.file(abs, { name: `raster/${basename(abs)}`, store: true });
            }

            await archive.finalize();
        }catch(err: any){
            console.error('downloadRasterImagesArchive error:', err);
            if(!res.headersSent){
                return res.status(500).json({
                    status: 'error',
                    data: { error: 'Failed to build raster images archive' }
                });
            }
            try{
                res.end();
            }catch{}
        }
    };