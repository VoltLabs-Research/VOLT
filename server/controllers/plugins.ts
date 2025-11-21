import { NextFunction, Request, Response } from 'express';
import { catchAsync } from '@/utilities/runtime';
import { getAnalysisQueue } from '@/queues';
import { Analysis, Trajectory } from '@/models';
import PluginRegistry from '@/services/plugins/plugins-registry';
import RuntimeError from '@/utilities/runtime-error';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import TrajectoryFS from '@/services/trajectory-fs';

// /api/plugins/:pluginId/modifier/:modifierId/trajectory/:trajectoryId { config }
export const evaluateModifier = catchAsync(async (req: Request, res: Response, next : NextFunction) => {
    const { pluginId, modifierId, trajectoryId } = req.params;
    const { config } = req.body;
    const { trajectory } = res.locals;

    const registry = new PluginRegistry();
    if(!registry.exists(pluginId) || !registry.modifierExists(pluginId, modifierId)){
        return next(new RuntimeError('Plugin::Registry::NotFound', 404));
    }

    const analysis = await Analysis.create({
        plugin: pluginId,
        modifier: modifierId,
        config: {},
        trajectory: trajectoryId
    });

    const analysisId = analysis._id.toString();
    const trajectoryFS = new TrajectoryFS(trajectoryId);
    const jobs: AnalysisJob[] = [];
    const promises = trajectory!.frames.map(async ({ timestep }: any) => {
        const inputFile = await trajectoryFS.getDump(timestep);
        jobs.push({
            trajectoryId,
            config: {},
            inputFile,
            analysisId,
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