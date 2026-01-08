
import { Trajectory, Analysis } from '@/models';
import jobManager from '@/services/jobs';
import logger from '@/logger';
import mongoose from 'mongoose';
import { Queues } from '@/constants/queues';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export class TrajectoryJobsService {
    /**
     * Clear all job history for a trajectory, including related analyses.
     */
    async clearHistory(trajectoryId: string, teamId: string) {
        try {
            const result = await jobManager.clearHistory(trajectoryId, teamId, {
                deleteRelated: this.deleteRelatedAnalyses
            });

            await Trajectory.findByIdAndUpdate(trajectoryId, { status: 'completed' });

            return {
                message: 'History cleared successfully',
                deletedJobs: result.deletedJobs,
                deletedAnalyses: result.deletedRelated,
                trajectoryId
            };
        } catch (error: any) {
            if (error.message === 'LOCK_CONFLICT') {
                throw new RuntimeError(ErrorCodes.LOCK_CONFLICT, 409);
            }
            logger.error(`[TrajectoryJobsService] clearHistory failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remove currently running jobs for a trajectory.
     */
    async removeRunningJobs(trajectoryId: string, teamId: string) {
        try {
            const result = await jobManager.removeActiveJobs(trajectoryId, teamId, {
                deleteRelated: this.deleteRelatedAnalyses
            });

            await Trajectory.findByIdAndUpdate(trajectoryId, { status: 'completed' });

            return {
                message: result.deletedJobs > 0 ? 'Running jobs removed' : 'No running jobs found',
                deletedJobs: result.deletedJobs,
                deletedAnalyses: result.deletedRelated,
                trajectoryId
            };
        } catch (error: any) {
            if (error.message === 'LOCK_CONFLICT') {
                throw new RuntimeError(ErrorCodes.LOCK_CONFLICT, 409);
            }
            logger.error(`[TrajectoryJobsService] removeRunningJobs failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get failed jobs for a trajectory.
     * @todo Implement re-queuing logic.
     */
    async retryFailedJobs(trajectoryId: string) {
        try {
            const failedJobs = await jobManager.getFailedJobs(trajectoryId);

            return {
                message: 'Failed jobs found',
                failedJobs: failedJobs.length,
                trajectoryId
            };
        } catch (error: any) {
            logger.error(`[TrajectoryJobsService] retryFailedJobs failed: ${error.message}`);
            throw error;
        }
    }

    // Helper to extract analysis IDs from jobs
    private extractAnalysisIds(jobs: any[]): string[] {
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
    private deleteRelatedAnalyses = async (jobs: any[]): Promise<number> => {
        const ids = this.extractAnalysisIds(jobs);
        if (ids.length === 0) return 0;
        const result = await Analysis.deleteMany({
            _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }
        });
        return result.deletedCount || 0;
    }
}

export default new TrajectoryJobsService();
