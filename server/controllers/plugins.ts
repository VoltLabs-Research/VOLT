import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime';
import { getAnalysisQueue } from '@/queues';
import { Analysis } from '@/models';
import { Exposure } from '@/types/services/plugin';
import PluginRegistry from '@/services/plugins/plugins-registry';
import RuntimeError from '@/utilities/runtime-error';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import TrajectoryFS from '@/services/trajectory-fs';
import ManifestService from '@/services/plugins/manifest-service';

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

// /api/plugins/exposures/:trajectoryId/ 
export const getTrajectoryExposures = catchAsync(async (req: Request, res: Response) => {
    const { trajectory } = res.locals;
    const trajectoryId = trajectory._id.toString();
    const analysis = await Analysis.find({ trajectory: trajectoryId });
    if(!analysis){
        return res.status(200).json({ status: 'success', data: [] });
    }
    const exposures: Exposure[] = [];
    const promises = analysis.map(async ({ plugin, modifier }) => {
        const manifestService = new ManifestService(plugin);
        const manifest = await manifestService.get();
        const modifierConfig = manifest.modifiers[modifier];
        const exposureConfigs = Object.values(modifierConfig.exposure);
        exposures.push(...exposureConfigs);
    });
    await Promise.all(promises);
    return res.status(200).json({ status: 'success', data: exposures });
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