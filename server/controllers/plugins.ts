import { NextFunction, Request, Response } from 'express';
import { catchAsync, slugify } from '@/utilities/runtime';
import { getAnalysisQueue } from '@/queues';
import { Analysis } from '@/models';
import PluginRegistry from '@/services/plugins/plugins-registry';
import RuntimeError from '@/utilities/runtime-error';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import TrajectoryFS from '@/services/trajectory-fs';
import { getStream, statObject } from '@/utilities/buckets';
import { SYS_BUCKETS } from '@/config/minio';

// /api/plugins/:pluginId/modifier/:modifierId/trajectory/:trajectoryId { config }
export const evaluateModifier = catchAsync(async (req: Request, res: Response, next : NextFunction) => {
    const { pluginId, modifierId, id: trajectoryId } = req.params;
    const { config } = req.body;
    const { trajectory } = res.locals;

    const registry = new PluginRegistry();
    if(!registry.exists(pluginId) || !registry.modifierExists(pluginId, modifierId)){
        return next(new RuntimeError('Plugin::Registry::NotFound', 404));
    }

    const analysis = await Analysis.create({
        plugin: pluginId,
        modifier: modifierId,
        config,
        trajectory: trajectoryId
    });

    const analysisId = analysis._id.toString();
    const trajectoryFS = new TrajectoryFS(trajectoryId);
    const jobs: AnalysisJob[] = [];
    const promises = trajectory!.frames.map(async ({ timestep }: any) => {
        const inputFile = await trajectoryFS.getDump(timestep);
        jobs.push({
            trajectoryId,
            config,
            inputFile,
            analysisId,
            modifierId,
            plugin: pluginId
        });
    });
    
    await Promise.all(promises);
    console.log(jobs)

    const analysisQueue = getAnalysisQueue();
    analysisQueue.addJobs(jobs);
    
    res.status(200).json({
        status: 'success'
    })
});

export const getPluginExposureGLB = catchAsync(async (req: Request, res: Response) => {
    const { timestep, analysisId, exposureId } = req.params;
    const { trajectory } = res.locals;
    const trajectoryId = trajectory._id.toString();
    const exposureKey = slugify(exposureId);

    try{
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/${exposureKey}.glb`;
        const stat = await statObject(objectName, SYS_BUCKETS.MODELS);
        const stream = await getStream(objectName, SYS_BUCKETS.MODELS);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${exposureId}_${timestep}.glb"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        stream.pipe(res);
    }catch(err){
        console.error('[getPluginExposureGLB] Error:', err);
        return res.status(404).json({ 
            status: 'error', 
            data: { error: `GLB not found for exposure ${exposureId} at timestep ${timestep}` }
        });
    }
});

export const getManifests = catchAsync(async (req: Request, res: Response) => {
    const registry = new PluginRegistry();
    const manifests = await registry.getManifests();
    const pluginIds = Object.keys(manifests);

    res.status(200).json({
        status: 'success',
        data: {
            manifests,
            pluginIds
        }
    });
});