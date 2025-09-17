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
import { AnalysisConfig, Trajectory } from '@/models';

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

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('ETag', `"raster-meta-${trajectory._id}"`);

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

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('ETag', `"raster-${trajectory._id}"`);

    return res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            analyses: analysesData
        }
    })
};