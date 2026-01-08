
import { Analysis, Trajectory, Plugin } from '@/models';
import { RasterizerOptions } from '@/utilities/export/rasterizer';
import { rasterizeGLBs } from '@/utilities/raster';
import { SYS_BUCKETS } from '@/config/minio';
import storage from '@/services/storage';
import logger from '@/logger';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

interface RasterFrameInfo {
    timestep: number;
    availableModels: string[];
}

export class RasterService {
    /**
     * Triggers the rasterization process for trajectory GLBs.
     */
    async processFrames(trajectory: any, options: Partial<RasterizerOptions>) {
        const trajectoryId = trajectory._id.toString();

        // Rasterize base trajectory previews
        const trajectoryPreviews = `trajectory-${trajectoryId}/previews/`;
        await rasterizeGLBs(trajectoryPreviews, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory, options);

        // Rasterize analysis GLBs
        const analyses = await Analysis.find({ trajectory: trajectoryId }).lean();
        const promises = analyses.map(async (analysis) => {
            const analysisId = analysis._id.toString();
            // Get plugin name for better job naming
            const plugin = await Plugin.findOne({ slug: analysis.plugin }).lean();
            const jobName = plugin?.name ? `Preview for ${plugin.name}` : undefined;
            // GLBs are stored at: trajectory-{trajectoryId}/analysis-{analysisId}/glb/{timestep}/{model}.glb
            const analysisGLBs = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/`;
            await rasterizeGLBs(analysisGLBs, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory, options, analysisId, jobName);
        });
        await Promise.all(promises);
    }

    /**
     * Returns metadata about available rasterized frames for a trajectory.
     */
    async getFrameMetadata(trajectory: any) {
        const trajectoryId = trajectory._id.toString();

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
            const timestepMatch = filename.match(/(?:timestep-)?(\d+)/);
            if (!timestepMatch) continue;

            const timestep = parseInt(timestepMatch[1], 10);
            if (!Number.isFinite(timestep)) continue;

            if (!availableRasters.has(timestep)) {
                availableRasters.set(timestep, new Set());
            }
            availableRasters.get(timestep)!.add('preview');
        }

        // Check for rasterized analysis models
        const analysisModelsMap = new Map<string, Map<number, Set<string>>>();

        for (const analysis of analyses) {
            const analysisId = analysis._id.toString();
            const modelsMap = new Map<number, Set<string>>();
            const rasterAnalysisPrefix = `trajectory-${trajectoryId}/analysis-${analysisId}/raster/`;

            for await (const key of storage.listByPrefix(SYS_BUCKETS.RASTERIZER, rasterAnalysisPrefix)) {
                if (!key.endsWith('.png')) continue;

                const filename = key.split('/').pop() || '';
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

            for (const frame of trajectory.frames || []) {
                const timestep = frame.timestep;
                const models: string[] = ['preview'];

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

        return { analyses: analysesMetadata };
    }

    /**
     * Returns the base64-encoded PNG data for a specific frame.
     */
    async getFrameData(trajectoryId: string, timestep: string | number, analysisId?: string, model?: string) {
        const frameNumber = Number(timestep);
        if (!Number.isFinite(frameNumber)) {
            throw new RuntimeError(ErrorCodes.TRAJECTORY_FILES_NOT_FOUND, 400);
        }

        let objectName: string;

        // Determine the correct path based on model type
        if (model === 'preview' || !analysisId || analysisId === 'undefined' || analysisId === '__preview__') {
            objectName = `trajectory-${trajectoryId}/previews/timestep-${frameNumber}.png`;
        } else {
            objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/raster/${frameNumber}_${model}.png`;
        }

        try {
            const buffer = await storage.getBuffer(SYS_BUCKETS.RASTERIZER, objectName);
            return {
                base64: `data:image/png;base64,${buffer.toString('base64')}`,
                model,
                frame: frameNumber,
                analysisId,
                etag: `"frame-${trajectoryId}-${frameNumber}-${model}-${analysisId}"`
            };
        } catch (err) {
            logger.warn(`Raster image not found: trajectory=${trajectoryId}, timestep=${timestep}, model=${model}, analysis=${analysisId}`);
            throw new RuntimeError(ErrorCodes.RASTER_NOT_FOUND, 404);
        }
    }
}

export default new RasterService();
