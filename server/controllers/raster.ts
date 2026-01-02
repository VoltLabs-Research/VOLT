import { Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime/runtime';
import { Analysis, Trajectory, Plugin } from '@/models';
import { RasterizerOptions } from '@/utilities/export/rasterizer';
import { rasterizeGLBs } from '@/utilities/raster';
import { SYS_BUCKETS } from '@/config/minio';
import storage from '@/services/storage';
import logger from '@/logger';

interface RasterFrameInfo {
    timestep: number;
    availableModels: string[];
}

export default class RasterController {
    /**
     * Triggers the rasterization process for trajectory GLBs.
     * This creates PNG previews from GLB files stored in MinIO.
     */
    public rasterizeFrames = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const opts: Partial<RasterizerOptions> = req.body ?? {};

        // Rasterize base trajectory previews
        const trajectoryPreviews = `trajectory-${trajectoryId}/previews/`;
        await rasterizeGLBs(trajectoryPreviews, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory, opts);

        // Rasterize analysis GLBs (color-coding/particle-filter are filtered in rasterizeGLBs by path)
        const analyses = await Analysis.find({ trajectory: trajectoryId }).lean();
        const promises = analyses.map(async (analysis) => {
            const analysisId = analysis._id.toString();
            // Get plugin name for better job naming
            const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
            const jobName = plugin?.name ? `Preview for ${plugin.name}` : undefined;
            // GLBs are stored at: trajectory-{trajectoryId}/analysis-{analysisId}/glb/{timestep}/{model}.glb
            const analysisGLBs = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/`;
            await rasterizeGLBs(analysisGLBs, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory, opts, analysisId, jobName);
        });
        await Promise.all(promises);

        return res.status(200).json({ status: 'success' });
    });

    /**
     * Returns metadata about available rasterized frames for a trajectory.
     * Lists available PNG files from MinIO and maps them to analyses.
     */
    public getRasterFrameMetadata = catchAsync(async (req: Request, res: Response) => {
        let trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();

        // Increment view counter
        trajectory = await Trajectory.findOneAndUpdate(
            { _id: trajectoryId },
            { $inc: { rasterSceneViews: 1 } },
            { new: true }
        );

        // Get all analyses for this trajectory
        const analyses = await Analysis
            .find({ trajectory: trajectoryId })
            .select('-__v')
            .lean();

        // List all rasterized PNGs from MinIO (base previews)
        const rasterPrefix = `trajectory-${trajectoryId}/previews/`;
        const availableRasters = new Map<number, Set<string>>();

        for await (const key of storage.listByPrefix(SYS_BUCKETS.RASTERIZER, rasterPrefix)) {
            if (!key.endsWith('.png')) continue;
            
            const filename = key.split('/').pop() || '';
            // Parse timestep from filename (e.g., "timestep-0.png")
            const timestepMatch = filename.match(/(?:timestep-)?(\d+)/);
            if (!timestepMatch) continue;
            
            const timestep = parseInt(timestepMatch[1], 10);
            if (!Number.isFinite(timestep)) continue;

            if (!availableRasters.has(timestep)) {
                availableRasters.set(timestep, new Set());
            }
            availableRasters.get(timestep)!.add('preview');
        }

        // Check for rasterized analysis models (only PNGs that actually exist)
        const analysisModelsMap = new Map<string, Map<number, Set<string>>>();

        for (const analysis of analyses) {
            const analysisId = analysis._id.toString();
            const modelsMap = new Map<number, Set<string>>();

            // Only list rasterized PNGs - don't list GLBs that haven't been rasterized yet
            const rasterAnalysisPrefix = `trajectory-${trajectoryId}/analysis-${analysisId}/raster/`;
            for await (const key of storage.listByPrefix(SYS_BUCKETS.RASTERIZER, rasterAnalysisPrefix)) {
                if (!key.endsWith('.png')) continue;
                
                const filename = key.split('/').pop() || '';
                // Parse: {timestep}_{model}.png
                const match = filename.match(/^(\d+)_(.+)\.png$/);
                if (!match) continue;
                
                const timestep = parseInt(match[1], 10);
                const model = match[2];
                if (!Number.isFinite(timestep)) continue;
                
                if (!modelsMap.has(timestep)) {
                    modelsMap.set(timestep, new Set());
                }
                modelsMap.get(timestep)!.add(model);
            }

            analysisModelsMap.set(analysisId, modelsMap);
        }

        // Build analyses metadata
        const analysesMetadata: Record<string, any> = {};

        for (const analysis of analyses) {
            const analysisId = analysis._id.toString();
            const framesMeta: Record<number, RasterFrameInfo> = {};
            const analysisModels = analysisModelsMap.get(analysisId) || new Map<number, Set<string>>();

            // Use trajectory frames as base, then add available models
            for (const frame of trajectory.frames || []) {
                const timestep = frame.timestep;
                const models: string[] = ['preview'];
                
                // Add models from analysis
                const modelsForTimestep = analysisModels.get(timestep);
                if (modelsForTimestep) {
                    for (const model of modelsForTimestep) {
                        models.push(model);
                    }
                }

                framesMeta[timestep] = {
                    timestep,
                    availableModels: [...new Set(models)]
                };
            }

            analysesMetadata[analysisId] = {
                ...analysis,
                _id: analysisId,
                frames: framesMeta
            };
        }

        // If no analyses, create a pseudo-analysis for preview-only mode
        if (analyses.length === 0 && availableRasters.size > 0) {
            const previewFrames: Record<number, RasterFrameInfo> = {};
            for (const [timestep] of availableRasters) {
                previewFrames[timestep] = {
                    timestep,
                    availableModels: ['preview']
                };
            }
            analysesMetadata['__preview__'] = {
                _id: '__preview__',
                plugin: 'preview',
                modifier: 'Preview',
                frames: previewFrames
            };
        }

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
        res.setHeader('ETag', `"raster-meta-${trajectoryId}-${trajectory.rasterSceneViews}"`);

        return res.status(200).json({
            status: 'success',
            data: { trajectory, analyses: analysesMetadata }
        });
    });

    /**
     * Returns the base64-encoded PNG data for a specific frame.
     */
    public getRasterFrameData = catchAsync(async (req: Request, res: Response) => {
        const trajectory = res.locals.trajectory;
        const trajectoryId = trajectory._id.toString();
        const { timestep, analysisId, model } = req.params;
        const frameNumber = Number(timestep);

        if (!Number.isFinite(frameNumber)) {
            return res.status(400).json({ status: 'error', message: 'Invalid timestep' });
        }

        try {
            let buffer: Buffer;
            let objectName: string;

            // Determine the correct path based on model type
            if (model === 'preview' || !analysisId || analysisId === 'undefined' || analysisId === '__preview__') {
                // Base trajectory preview
                objectName = `trajectory-${trajectoryId}/previews/timestep-${frameNumber}.png`;
            } else {
                // Analysis-specific model - stored at: trajectory-{id}/analysis-{analysisId}/raster/{timestep}_{model}.png
                objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/raster/${frameNumber}_${model}.png`;
            }

            buffer = await storage.getBuffer(SYS_BUCKETS.RASTERIZER, objectName);
            const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            res.setHeader('ETag', `"frame-${trajectoryId}-${frameNumber}-${model}-${analysisId}"`);

            return res.status(200).json({
                status: 'success',
                data: { model, frame: frameNumber, analysisId, data: base64 }
            });
        } catch (err) {
            logger.warn(`Raster image not found: trajectory=${trajectoryId}, timestep=${timestep}, model=${model}, analysis=${analysisId}`);
            return res.status(404).json({ status: 'error', message: 'Raster image not found' });
        }
    });
}
