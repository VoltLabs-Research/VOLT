import { Request, Response } from 'express';
import { Trajectory, Analysis } from '@/models';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import jobManager from '@/services/jobs';
import logger from '@/logger';
import mongoose from 'mongoose';
import { Queues } from '@/constants/queues';

// Helper to extract analysis IDs from jobs
function extractAnalysisIds(jobs: any[]): string[] {
    const ids = new Set<string>();
    for (const job of jobs) {
        if (job.queueType === Queues.ANALYSIS_PROCESSING && job.jobId) {
            const parts = job.jobId.split('-');
            if (parts.length >= 2) ids.add(parts.slice(0, -1).join('-'));
        }
        if (job.analysisId) ids.add(job.analysisId);
    }
    return [...ids];
}

// Helper to delete related analyses
async function deleteRelatedAnalyses(jobs: any[]): Promise<number> {
    const ids = extractAnalysisIds(jobs);
    if (ids.length === 0) return 0;
    const result = await Analysis.deleteMany({
        _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }
    });
    return result.deletedCount || 0;
}

export default class TrajectoryJobsController extends BaseController<any> {
    constructor() {
        super(Trajectory, {
            resource: Resource.TRAJECTORY,
            fields: ['team']
        });
    }

    private async validateTrajectory(req: Request, res: Response): Promise<{ trajectoryId: string; teamId: string } | null> {
        const { trajectoryId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(trajectoryId)) {
            res.status(400).json({ message: 'Invalid trajectory ID' });
            return null;
        }

        const trajectory = await Trajectory.findById(trajectoryId);
        if (!trajectory) {
            res.status(404).json({ message: 'Trajectory not found' });
            return null;
        }

        const teamId = await this.getTeamId(req);
        if (trajectory.team?.toString() !== teamId) {
            res.status(403).json({ message: 'Access denied' });
            return null;
        }

        return { trajectoryId, teamId };
    }

    clearHistory = async (req: Request, res: Response) => {
        try {
            const ctx = await this.validateTrajectory(req, res);
            if (!ctx) return;

            const result = await jobManager.clearHistory(ctx.trajectoryId, ctx.teamId, {
                deleteRelated: deleteRelatedAnalyses
            });

            await Trajectory.findByIdAndUpdate(ctx.trajectoryId, { status: 'completed' });

            return res.json({
                message: 'History cleared successfully',
                deletedJobs: result.deletedJobs,
                deletedAnalyses: result.deletedRelated,
                trajectoryId: ctx.trajectoryId
            });
        } catch (error: any) {
            if (error.message === 'LOCK_CONFLICT') {
                return res.status(409).json({ message: 'Another operation is in progress' });
            }
            logger.error(`[TrajectoryJobs] clearHistory failed: ${error.message}`);
            return res.status(500).json({ message: 'Failed', error: error.message });
        }
    };

    removeRunningJobs = async (req: Request, res: Response) => {
        try {
            const ctx = await this.validateTrajectory(req, res);
            if (!ctx) return;

            const result = await jobManager.removeActiveJobs(ctx.trajectoryId, ctx.teamId, {
                deleteRelated: deleteRelatedAnalyses
            });

            await Trajectory.findByIdAndUpdate(ctx.trajectoryId, { status: 'completed' });

            return res.json({
                message: result.deletedJobs > 0 ? 'Running jobs removed' : 'No running jobs found',
                deletedJobs: result.deletedJobs,
                deletedAnalyses: result.deletedRelated,
                trajectoryId: ctx.trajectoryId
            });
        } catch (error: any) {
            if (error.message === 'LOCK_CONFLICT') {
                return res.status(409).json({ message: 'Another operation is in progress' });
            }
            logger.error(`[TrajectoryJobs] removeRunningJobs failed: ${error.message}`);
            return res.status(500).json({ message: 'Failed', error: error.message });
        }
    };

    retryFailedJobs = async (req: Request, res: Response) => {
        try {
            const ctx = await this.validateTrajectory(req, res);
            if (!ctx) return;

            const failedJobs = await jobManager.getFailedJobs(ctx.trajectoryId);

            // TODO: Re-queue failed jobs
            return res.json({
                message: 'Failed jobs found',
                failedJobs: failedJobs.length,
                trajectoryId: ctx.trajectoryId
            });
        } catch (error: any) {
            logger.error(`[TrajectoryJobs] retryFailedJobs failed: ${error.message}`);
            return res.status(500).json({ message: 'Failed', error: error.message });
        }
    };
}
