import { Analysis, Trajectory, PluginExposureMeta, Plugin } from '@/models';
import { Resource } from '@/constants/resources';
import BaseController from '@/controllers/base-controller';
import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import { getAnalysisQueue } from '@/queues';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import { PluginStatus } from '@/types/models/plugin';

export default class AnalysisConfigController extends BaseController<any> {
    constructor() {
        super(Analysis, {
            resource: Resource.ANALYSIS,
            fields: ['createdBy'],
            populate: { path: 'trajectory', select: 'name' }
        });
    }

    protected async getFilter(req: Request): Promise<FilterQuery<any>> {
        const teamId = await this.getTeamId(req);

        // Validate teamId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(teamId)) {
            return { _id: new mongoose.Types.ObjectId() }; // Return impossible filter
        }

        // Find all trajectories that belong to this team
        const trajectories = await Trajectory.find({ team: teamId }).select('_id');
        const trajectoryIds = trajectories.map(t => t._id);

        // Filter analyses by trajectory IDs
        return { trajectory: { $in: trajectoryIds } };
    }

    /**
     * Retry failed frames for an analysis
     * Detects frames without results in PluginExposureMeta and requeues them (max 1 retry attempt)
     */
    retryFailedFrames = async (req: Request, res: Response) => {
        try {
            const { id: analysisId } = req.params;

            // Get analysis with populated trajectory
            const analysis = await Analysis.findById(analysisId).populate('trajectory');
            if (!analysis) {
                return res.status(404).json({ message: 'Analysis not found' });
            }

            const trajectory = analysis.trajectory as any;
            if (!trajectory || !trajectory.frames) {
                return res.status(404).json({ message: 'Trajectory or frames not found' });
            }

            // Verify team membership
            const teamId = await this.getTeamId(req);
            const teamIdStr = trajectory.team?.toString();
            if (teamIdStr !== teamId) {
                return res.status(403).json({ message: 'Access denied' });
            }

            // Get plugin
            const plugin = await Plugin.findOne({
                slug: analysis.plugin,
                status: PluginStatus.PUBLISHED
            });

            if (!plugin) {
                return res.status(404).json({ message: 'Plugin not found or not published' });
            }

            // Get all timesteps from trajectory
            const allTimesteps = trajectory.frames.map((frame: any) => frame.timestep);

            // Get timesteps that have results in PluginExposureMeta
            const completedTimesteps = await PluginExposureMeta.distinct('timestep', {
                analysis: analysisId
            });

            // Failed frames are those without results
            const failedTimesteps = allTimesteps.filter(
                (ts: number) => !completedTimesteps.includes(ts)
            );

            if (failedTimesteps.length === 0) {
                return res.json({
                    message: 'No failed frames found',
                    retriedFrames: 0,
                    totalFrames: allTimesteps.length
                });
            }

            // Create jobs for failed frames
            const jobs: AnalysisJob[] = [];

            for (const timestep of failedTimesteps) {
                const frameIndex = trajectory.frames.findIndex((f: any) => f.timestep === timestep);
                if (frameIndex === -1) continue;

                const frame = trajectory.frames[frameIndex];

                // @ts-ignore - totalItems and itemIndex are used but not in type definition
                jobs.push({
                    jobId: `${analysisId}-${frameIndex}`,
                    teamId: teamIdStr,
                    trajectoryId: trajectory._id.toString(),
                    config: analysis.config,
                    inputFile: frame.path || '',
                    analysisId: analysisId.toString(),
                    timestep: frame.timestep ?? frame.frame,
                    trajectoryName: trajectory.name,
                    modifierId: plugin.slug,
                    plugin: plugin.slug,
                    name: plugin.modifier?.name || plugin.slug,
                    message: trajectory.name,
                    totalItems: allTimesteps.length,
                    itemIndex: frameIndex,
                    forEachItem: frame,
                    forEachIndex: frameIndex
                });
            }

            // Add jobs to queue
            const analysisQueue = getAnalysisQueue();
            analysisQueue.addJobs(jobs);

            return res.json({
                message: 'Failed frames queued for retry',
                retriedFrames: jobs.length,
                totalFrames: allTimesteps.length,
                failedTimesteps
            });
        } catch (error: any) {
            return res.status(500).json({
                message: 'Failed to retry frames',
                error: error.message
            });
        }
    };
};
