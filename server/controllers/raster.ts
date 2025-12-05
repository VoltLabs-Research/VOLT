import { Request, Response } from 'express';
import { join, resolve, basename } from 'path';
import { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';
import { catchAsync } from '@/utilities/runtime/runtime';
import { readFile } from 'fs/promises';;
import { readdir } from 'fs/promises';
import { Analysis, Trajectory } from '@/models';
import { getTimestepPreview, rasterizeGLBs } from '@/utilities/raster';
import { SYS_BUCKETS } from '@/config/minio';
import TrajectoryVFS from '@/services/trajectory-vfs';
import archiver from 'archiver';
import logger from '@/logger';

export const rasterizeFrames = catchAsync(async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const opts: Partial<HeadlessRasterizerOptions> = req.body ?? {};

    const trajectoryPreviews = `trajectory-${trajectoryId}/previews/`;
    await rasterizeGLBs(trajectoryPreviews, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory, opts);

    // Raster GLBs generated from plugins modifiers
    const analyses = await Analysis.find({ trajectory: trajectoryId }).lean();
    const promises = analyses.map(async (analysis) => {
        const analysisId = analysis._id.toString();
        const analysisPreviews = `trajectory-${trajectoryId}/plugins/${analysis.plugin}/${analysis.modifier}/analisis-${analysisId}`;
        await rasterizeGLBs(analysisPreviews, SYS_BUCKETS.MODELS, SYS_BUCKETS.RASTERIZER, trajectory, opts);
    });
    await Promise.all(promises);

    return res.status(200).json({ status: 'succes' });
});

export const getRasterFrameMetadata = async (req: Request, res: Response) => {
    let trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();

    trajectory = await Trajectory.findOneAndUpdate(
        { _id: trajectoryId },
        { $inc: { rasterSceneViews: 1 } },
        { new: true }
    );

    const analyses = await Analysis
        .find({ trajectory: trajectoryId })
        .select('-__v')
        .lean();

    const vfs = new TrajectoryVFS(trajectoryId);
    const analysesMetadata: Record<string, any> = {};

    for(const analysis of analyses){
        const id = String(analysis._id);
        const framesMeta: Record<string, any> = {};

        const rasterFiles = await vfs.list(`trajectory-${trajectoryId}/analysis-${id}/raster`);

        for(const { timestep } of trajectory.frames){
            const relevantFiles = rasterFiles.filter(f => f.name.startsWith(`${timestep}`) || f.relPath.includes(`/${timestep}/`));
            const models = relevantFiles.map(f => {
                const base = f.name.replace('.png', '').replace(`${timestep}_`, '').replace(`${timestep}/`, '');
                return base;
            });

            framesMeta[timestep] = {
                timestep,
                availableModels: ['preview', ...models]
            };

            analysesMetadata[id] = { ...analysis, frames: framesMeta };
        }
    }

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private');
    res.setHeader('ETag', `"raster-meta-${trajectoryId}-${trajectory.rasterSceneViews}"`);

    return res.status(200).json({
        status: 'success',
        data: { trajectory, analyses: analysesMetadata }
    });
};

export const getRasterFrameData = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const { timestep, analysisId, model } = req.params;
    const frameNumber = Number(timestep);

    if (!Number.isFinite(frameNumber)) return res.status(400).json({ status: 'error', message: 'Invalid timestep' });

    try {
        let buffer: Buffer;

        if (model === 'preview' || !analysisId || analysisId === 'undefined') {
            const resPreview = await getTimestepPreview(trajectoryId, frameNumber);
            buffer = resPreview.buffer;
        } else {
            const vfs = new TrajectoryVFS(trajectoryId);
            const virtualPath = `trajectory-${trajectoryId}/analysis-${analysisId}/raster/${timestep}_${model}.png`;
            const { stream } = await vfs.getReadStream(virtualPath);
            buffer = await streamToBuffer(stream);
        }

        const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
        
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); 
        res.setHeader('ETag', `"frame-${trajectoryId}-${frameNumber}-${model}-${analysisId}"`);
        
        return res.status(200).json({
            status: 'success',
            data: { model, frame: frameNumber, analysisId, data: base64 }
        });
    } catch (err) {
        return res.status(404).json({ status: 'error', message: 'Raster image not found' });
    }
};


/**
 * DEPRECATED / HEAVY LOAD: Devuelve TODOS los frames en base64 en un solo JSON gigante.
 * Esto matará la RAM del servidor con trayectorias grandes.
 * Recomendación: Usar paginación o carga bajo demanda (Lazy Loading) en el frontend.
 * Mantengo la lógica adaptada a VFS pero ten cuidado.
 */
export const getRasterizedFrames = async (req: Request, res: Response) => {
   /* let trajectory = res.locals.trajectory;
    const trajectoryId = trajectory._id.toString();
    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const rasterDir = join(basePath, trajectoryId, 'raster');

    trajectory = await Trajectory.findOneAndUpdate(
        { _id: trajectoryId },
        { $inc: { rasterSceneViews: 1 } },
        { new: true }
    );

    const analyses = await Analysis
        .find({ trajectory: trajectoryId })
        .select('-createdAt -updatedAt -__v')
        .lean();

    const analysesData: Record<string, any> = {};
    const trajFS = new TrajectoryVFS(trajectoryId);

    for (const analysis of analyses) {
        const id = analysis._id.toString();
        const data: Record<string, any> = {
            ...analysis,
            frames: {}
        };

        for (const { timestep } of trajectory.frames) {
            const models: Record<string, any> = {};
            const availableModels = await trajFS.listRasterAnalyses(trajectoryId, timestep, id);

            for (const model of availableModels) {
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
    const etagBase = `raster-${trajectoryId}-${trajectory.rasterSceneViews}-${trajectory.frames?.length ?? 0}`;
    res.setHeader('ETag', `"${etagBase}"`);

    return res.status(200).json({
        status: 'success',
        data: {
            trajectory,
            analyses: analysesData
        }
    })*/
};


export const downloadRasterImagesArchive = async (req: Request, res: Response) => {
    const trajectory = res.locals?.trajectory;
    const trajectoryId = trajectory._id.toString();
    const { analysisId, model, includePreview } = req.query as {
        analysisId?: string; model?: string; includePreview?: string;
    };

    if (!trajectory) return res.status(400).json({ status: 'error', data: { error: 'Trajectory not found' } });

    try {
        const tfs = new TrajectoryVFS(trajectoryId);
        const wantPreview = includePreview === '1' || includePreview === 'true';
        
        const filesToArchive: Array<{ path: string, name: string }> = [];

        // 1. Collect Previews
        if (wantPreview) {
            try {
                const previews = await tfs.list(`trajectory-${trajectoryId}/raster`);
                for (const p of previews) {
                    if (p.type === 'file' && p.name.endsWith('.png')) {
                        filesToArchive.push({ path: p.relPath, name: `previews/${p.name}` });
                    }
                }
            } catch { /* ignore if empty */ }
        }

        if (analysisId) {
            try {
                const rasterFiles = await tfs.list(`trajectory-${trajectoryId}/analysis-${analysisId}/raster`);
                for (const f of rasterFiles) {
                    if (f.type !== 'file' || !f.name.endsWith('.png')) continue;
                    // Filtro opcional por modelo
                    if (model && !f.name.includes(model)) continue;
                    
                    filesToArchive.push({ path: f.relPath, name: `analysis/${f.name}` });
                }
            } catch { /* ignore */ }
        }

        if (!filesToArchive.length) {
            return res.status(404).json({ status: 'error', data: { error: 'No images found' } });
        }

        const filenameSafe = String(trajectory.name || trajectoryId).replace(/[^a-z0-9_\-]+/gi, '_');
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameSafe}_raster.zip"`);

        const archive = archiver('zip', { zlib: { level: 0 } }); 
        archive.on('error', (err) => {
             logger.error(`Zip error: ${err}`);
             if(!res.headersSent) res.status(500).end();
        });

        archive.pipe(res);

        for (const file of filesToArchive) {
            try {
                const { stream } = await tfs.getReadStream(file.path);
                archive.append(stream, { name: file.name });
            } catch (e) {
                logger.warn(`Skipping missing file in archive: ${file.path}`);
            }
        }

        await archive.finalize();

    } catch (err) {
        logger.error(`Download Raster Error: ${err}`);
        if (!res.headersSent) res.status(500).json({ error: 'Archive creation failed' });
    }
};

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}