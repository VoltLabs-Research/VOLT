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

    // The raster frame is stored in the following format "<frame>.glb".
    // Other models produced by modifiers, such as dislocations, are exported in 
    // the following format: "frame-<frame>_<model>-analysis-<analysisId>".
    for(const analysis of analyses){
        const id = analysis._id.toString();
        const data: Record<string, any> = {
            ...analysis,
            frames: {}
        };

        for(const { timestep } of trajectory.frames){
            const models: Record<string, any> = {};
            // [ 'defect_mesh', 'dislocations', 'interface_mesh', ... ]
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