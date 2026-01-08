import { Request, Response } from 'express';
import { Trajectory } from '@/models';
import BaseController from '@/controllers/base-controller';
import { Resource } from '@/constants/resources';
import logger from '@/logger';
import mongoose from 'mongoose';
import trajectoryJobsService from '@/services/trajectory-jobs-service';
import RuntimeError from '@/utilities/runtime/runtime-error';

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

            const result = await trajectoryJobsService.clearHistory(ctx.trajectoryId, ctx.teamId);
            return res.json(result);
        } catch (error: any) {
            if (error instanceof RuntimeError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            // Fallback for non-RuntimeErrors that might still match the legacy check
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

            const result = await trajectoryJobsService.removeRunningJobs(ctx.trajectoryId, ctx.teamId);
            return res.json(result);
        } catch (error: any) {
            if (error instanceof RuntimeError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
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

            const result = await trajectoryJobsService.retryFailedJobs(ctx.trajectoryId);
            return res.json(result);
        } catch (error: any) {
            logger.error(`[TrajectoryJobs] retryFailedJobs failed: ${error.message}`);
            return res.status(500).json({ message: 'Failed', error: error.message });
        }
    };
}
