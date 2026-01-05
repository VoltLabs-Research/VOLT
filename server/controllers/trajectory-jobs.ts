import { Request, Response } from 'express';
import { Trajectory, Analysis } from '@/models';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import trajectoryJobManager from '@/services/trajectory-job-manager';
import logger from '@/logger';
import mongoose from 'mongoose';
import { getAnalysisQueue } from '@/queues';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import { Plugin, PluginExposureMeta } from '@/models';
import { PluginStatus } from '@/types/models/plugin';

export default class TrajectoryJobsController extends BaseController<any> {
    constructor() {
        super(Trajectory, {
            resource: Resource.TRAJECTORY,
            fields: ['team']
        });
    }

    /**
     * Clear all job history for a trajectory
     * Deletes all jobs from Redis and active analyses, then resets trajectory status to 'completed'
     */
    clearHistory = async (req: Request, res: Response) => {
        const { trajectoryId } = req.params;

        try {
            // Validate trajectory ID
            if (!mongoose.Types.ObjectId.isValid(trajectoryId)) {
                return res.status(400).json({ message: 'Invalid trajectory ID' });
            }

            // Get trajectory and verify team membership
            const trajectory = await Trajectory.findById(trajectoryId);
            if (!trajectory) {
                return res.status(404).json({ message: 'Trajectory not found' });
            }

            const teamId = await this.getTeamId(req);
            const trajectoryTeamId = trajectory.team?.toString();
            if (trajectoryTeamId !== teamId) {
                return res.status(403).json({ message: 'Access denied' });
            }

            logger.info(`[TrajectoryJobs] Clearing history for trajectory ${trajectoryId}...`);

            // Acquire cleanup lock
            const lockAcquired = await trajectoryJobManager.acquireCleanupLock(trajectoryId, 120000);
            if (!lockAcquired) {
                return res.status(409).json({
                    message: 'Another cleanup operation is in progress for this trajectory'
                });
            }

            try {
                // 1. Scan and delete all jobs from Redis
                const { jobs } = await trajectoryJobManager.scanJobsForTrajectory(trajectoryId);
                const deletedJobsCount = await trajectoryJobManager.deleteJobs(jobs);

                // 2. Delete all active analyses (cascade delete will clean up MinIO and meta)
                const analysesResult = await Analysis.deleteMany({
                    trajectory: trajectoryId,
                    finishedAt: { $exists: false }
                });
                const deletedAnalysesCount = analysesResult.deletedCount || 0;

                // 3. Clear trajectory metadata from Redis
                await trajectoryJobManager.clearTrajectoryMetadata(trajectoryId);

                // 4. Reset trajectory status to 'completed'
                await Trajectory.findByIdAndUpdate(trajectoryId, {
                    status: 'completed'
                });

                // 5. Publish event to notify WebSocket clients
                await trajectoryJobManager.publishJobClearEvent(
                    teamId,
                    trajectoryId,
                    'trajectory_history_cleared'
                );

                logger.info(`[TrajectoryJobs] History cleared for ${trajectoryId}: ${deletedJobsCount} jobs, ${deletedAnalysesCount} analyses`);

                return res.json({
                    message: 'History cleared successfully',
                    deletedJobs: deletedJobsCount,
                    deletedAnalyses: deletedAnalysesCount,
                    trajectoryId
                });
            } finally {
                await trajectoryJobManager.releaseCleanupLock(trajectoryId);
            }
        } catch (error: any) {
            logger.error(`[TrajectoryJobs] clearHistory failed: ${error.message}`);
            return res.status(500).json({
                message: 'Failed to clear history',
                error: error.message
            });
        }
    };

    /**
     * Remove only running/queued jobs for a trajectory
     * Deletes running jobs from Redis and their analyses, then resets trajectory status
     */
    removeRunningJobs = async (req: Request, res: Response) => {
        const { trajectoryId } = req.params;

        try {
            // Validate trajectory ID
            if (!mongoose.Types.ObjectId.isValid(trajectoryId)) {
                return res.status(400).json({ message: 'Invalid trajectory ID' });
            }

            // Get trajectory and verify team membership
            const trajectory = await Trajectory.findById(trajectoryId);
            if (!trajectory) {
                return res.status(404).json({ message: 'Trajectory not found' });
            }

            const teamId = await this.getTeamId(req);
            const trajectoryTeamId = trajectory.team?.toString();
            if (trajectoryTeamId !== teamId) {
                return res.status(403).json({ message: 'Access denied' });
            }

            logger.info(`[TrajectoryJobs] Removing running jobs for trajectory ${trajectoryId}...`);

            // Acquire cleanup lock
            const lockAcquired = await trajectoryJobManager.acquireCleanupLock(trajectoryId, 120000);
            if (!lockAcquired) {
                return res.status(409).json({
                    message: 'Another cleanup operation is in progress for this trajectory'
                });
            }

            try {
                // 1. Scan for only running/queued jobs
                const { jobs } = await trajectoryJobManager.scanJobsForTrajectory(
                    trajectoryId,
                    ['running', 'queued', 'retrying']
                );

                if (jobs.length === 0) {
                    await trajectoryJobManager.releaseCleanupLock(trajectoryId);
                    return res.json({
                        message: 'No running jobs found',
                        deletedJobs: 0,
                        deletedAnalyses: 0,
                        trajectoryId
                    });
                }

                // 2. Extract unique analysis IDs from running jobs
                const analysisIds = trajectoryJobManager.extractAnalysisIds(jobs);

                // 3. Delete jobs from Redis
                const deletedJobsCount = await trajectoryJobManager.deleteJobs(jobs);

                // 4. Delete analyses related to running jobs
                let deletedAnalysesCount = 0;
                if (analysisIds.length > 0) {
                    const analysesResult = await Analysis.deleteMany({
                        _id: { $in: analysisIds.map(id => new mongoose.Types.ObjectId(id)) }
                    });
                    deletedAnalysesCount = analysesResult.deletedCount || 0;
                }

                // 5. Reset trajectory status to 'completed'
                await Trajectory.findByIdAndUpdate(trajectoryId, {
                    status: 'completed'
                });

                // 6. Clear trajectory metadata if no jobs remain
                const { jobs: remainingJobs } = await trajectoryJobManager.scanJobsForTrajectory(trajectoryId);
                if (remainingJobs.length === 0) {
                    await trajectoryJobManager.clearTrajectoryMetadata(trajectoryId);
                }

                // 7. Publish event to notify WebSocket clients
                await trajectoryJobManager.publishJobClearEvent(
                    teamId,
                    trajectoryId,
                    'trajectory_running_jobs_removed'
                );

                logger.info(`[TrajectoryJobs] Running jobs removed for ${trajectoryId}: ${deletedJobsCount} jobs, ${deletedAnalysesCount} analyses`);

                return res.json({
                    message: 'Running jobs removed successfully',
                    deletedJobs: deletedJobsCount,
                    deletedAnalyses: deletedAnalysesCount,
                    trajectoryId
                });
            } finally {
                await trajectoryJobManager.releaseCleanupLock(trajectoryId);
            }
        } catch (error: any) {
            logger.error(`[TrajectoryJobs] removeRunningJobs failed: ${error.message}`);
            return res.status(500).json({
                message: 'Failed to remove running jobs',
                error: error.message
            });
        }
    };

    /**
     * Retry all failed jobs for a trajectory
     * Finds all analyses and retries failed frames for each
     */
    retryFailedJobs = async (req: Request, res: Response) => {
        const { trajectoryId } = req.params;

        try {
            // Validate trajectory ID
            if (!mongoose.Types.ObjectId.isValid(trajectoryId)) {
                return res.status(400).json({ message: 'Invalid trajectory ID' });
            }

            // Get trajectory with frames
            const trajectory = await Trajectory.findById(trajectoryId);
            if (!trajectory) {
                return res.status(404).json({ message: 'Trajectory not found' });
            }

            const teamId = await this.getTeamId(req);
            const trajectoryTeamId = trajectory.team?.toString();
            if (trajectoryTeamId !== teamId) {
                return res.status(403).json({ message: 'Access denied' });
            }

            logger.info(`[TrajectoryJobs] Retrying failed jobs for trajectory ${trajectoryId}...`);

            // Get all analyses for this trajectory
            const analyses = await Analysis.find({ trajectory: trajectoryId });

            if (analyses.length === 0) {
                return res.json({
                    message: 'No analyses found for this trajectory',
                    retriedFrames: 0,
                    analysesProcessed: 0,
                    trajectoryId
                });
            }

            let totalRetriedFrames = 0;
            const analysisQueue = getAnalysisQueue();

            // Process each analysis
            for (const analysis of analyses) {
                try {
                    // Get all timesteps from trajectory
                    const allTimesteps = (trajectory.frames || []).map((frame: any) => frame.timestep);

                    if (allTimesteps.length === 0) continue;

                    // Get completed timesteps from PluginExposureMeta
                    const completedTimesteps = await PluginExposureMeta.distinct('timestep', {
                        analysis: analysis._id
                    });

                    // Calculate failed timesteps
                    const failedTimesteps = allTimesteps.filter(
                        (ts: number) => !completedTimesteps.includes(ts)
                    );

                    if (failedTimesteps.length === 0) continue;

                    // Get plugin
                    const plugin = await Plugin.findOne({
                        slug: analysis.plugin,
                        status: PluginStatus.PUBLISHED
                    });

                    if (!plugin) {
                        logger.warn(`[TrajectoryJobs] Plugin ${analysis.plugin} not found for analysis ${analysis._id}`);
                        continue;
                    }

                    // Create jobs for failed frames
                    const jobs: AnalysisJob[] = [];

                    for (const timestep of failedTimesteps) {
                        const frameIndex = trajectory.frames!.findIndex((f: any) => f.timestep === timestep);
                        if (frameIndex === -1) continue;

                        const frame = trajectory.frames![frameIndex];

                        // @ts-ignore - totalItems and itemIndex are used but not in type definition
                        jobs.push({
                            jobId: `${analysis._id}-${frameIndex}`,
                            teamId: trajectoryTeamId,
                            trajectoryId: trajectoryId,
                            config: analysis.config,
                            inputFile: (frame as any).path || '',
                            analysisId: analysis._id.toString(),
                            timestep: (frame as any).timestep ?? (frame as any).frame,
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
                    if (jobs.length > 0) {
                        analysisQueue.addJobs(jobs);
                        totalRetriedFrames += jobs.length;
                        logger.info(`[TrajectoryJobs] Queued ${jobs.length} failed frames for analysis ${analysis._id}`);
                    }
                } catch (error) {
                    logger.error(`[TrajectoryJobs] Failed to retry frames for analysis ${analysis._id}: ${error}`);
                }
            }

            return res.json({
                message: 'Failed jobs queued for retry',
                retriedFrames: totalRetriedFrames,
                analysesProcessed: analyses.length,
                trajectoryId
            });
        } catch (error: any) {
            logger.error(`[TrajectoryJobs] retryFailedJobs failed: ${error.message}`);
            return res.status(500).json({
                message: 'Failed to retry failed jobs',
                error: error.message
            });
        }
    };
}
