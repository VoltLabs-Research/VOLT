
import { Trajectory, Analysis } from '@/models';
import jobManager from '@/services/jobs';
import logger from '@/logger';
import mongoose from 'mongoose';
import { Queues } from '@/constants/queues';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { redis } from '@/config/redis';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { getTrajectoryProcessingQueue, getAnalysisQueue, getRasterizerQueue, getSSHImportQueue, getCloudUploadQueue } from '@/queues';

interface FrameJobGroup {
    timestep: number;
    jobs: BaseJob[];
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
}

interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
    completedCount: number;
    totalCount: number;
}

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

    /**
     * Get and group jobs for a team from Redis.
     */
    async getGroupedJobsForTeam(teamId: string): Promise<TrajectoryJobGroup[]> {
        if (!teamId) return [];
        const startTime = Date.now();
        //logger.info(`[Socket] Fetching grouped jobs for team ${teamId}...`);

        const allQueues = this.getAllProcessingQueues();
        const teamJobsKey = `team:${teamId}:jobs`;
        const jobIds = await redis?.smembers(teamJobsKey);

        if (!jobIds?.length) {
            //logger.info(`[Socket] No jobs found for team ${teamId}`);
            return [];
        }

        const queueResults = await Promise.all(allQueues.map(async ({ name, queue }) => {
            const statusKeys = jobIds.map((id) => `${queue.queueKey}:status:${id}`);
            const batchSize = 500;
            const jobs: BaseJob[] = [];

            for (let i = 0; i < statusKeys.length; i += batchSize) {
                const batchKeys = statusKeys.slice(i, i + batchSize);
                const pipeline = redis?.pipeline();
                batchKeys.forEach((k) => pipeline?.get(k));
                const results = (await pipeline?.exec()) || [];

                for (const [_, value] of results) {
                    if (!value) continue;
                    const data = JSON.parse(value as string);
                    if (data.teamId !== teamId) continue;
                    jobs.push({ ...data, queueType: name });
                }
            }
            return jobs;
        }));

        const jobMap = new Map<string, BaseJob>();
        for (const job of queueResults.flat()) {
            const prev = jobMap.get(job.jobId);
            const tNew = (job as any).timestamp ? new Date((job as any).timestamp).getTime() : 0;
            const tPrev = (prev as any)?.timestamp ? new Date((prev as any).timestamp).getTime() : 0;
            if (!prev || tNew > tPrev) jobMap.set(job.jobId, job);
        }

        const uniqueJobs = Array.from(jobMap.values());
        const grouped = this.groupJobsByTrajectory(uniqueJobs);

        //logger.info(`[Socket] Grouped ${uniqueJobs.length} jobs into ${grouped.length} trajectories in ${Date.now() - startTime}ms`);
        return grouped;
    }

    normalizeUpdate(jobData: any) {
        return {
            jobId: jobData.jobId,
            status: jobData.status,
            progress: jobData.progress || 0,
            name: jobData.name,
            message: jobData.message,
            trajectoryId: jobData.trajectoryId,
            trajectoryName: jobData.trajectoryName,
            timestep: jobData.timestep,
            sessionId: jobData.sessionId,
            sessionStartTime: jobData.sessionStartTime,
            timestamp: jobData.timestamp || new Date().toISOString(),
            queueType: jobData.queueType || 'unknown',
            type: jobData.type,
            ...(jobData.error && { error: jobData.error }),
            ...(jobData.result && { result: jobData.result }),
            ...(jobData.processingTimeMs && { processingTimeMs: jobData.processingTimeMs })
        };
    }

    // --- Private Helpers ---

    private getAllProcessingQueues() {
        return [
            { name: 'trajectory', queue: getTrajectoryProcessingQueue() },
            { name: 'analysis', queue: getAnalysisQueue() },
            { name: 'raster', queue: getRasterizerQueue() },
            { name: 'ssh-import', queue: getSSHImportQueue() },
            { name: 'cloud-upload', queue: getCloudUploadQueue() }
        ];
    }

    private computeStatus(jobs: BaseJob[]): 'running' | 'completed' | 'failed' | 'partial' {
        const hasRunning = jobs.some((j: any) => j.status === 'running' || j.status === 'queued');
        const hasFailed = jobs.some((j: any) => j.status === 'failed');
        const allCompleted = jobs.every((j: any) => j.status === 'completed');
        if (hasRunning) return 'running';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter((j: any) => j.status === 'completed').length === 0) return 'failed';
        return 'partial';
    }

    private groupJobsByFrame(jobs: BaseJob[]): FrameJobGroup[] {
        const frameMap = new Map<number, BaseJob[]>();
        for (const job of jobs) {
            const key = (job as any).timestep;
            if (!frameMap.has(key)) frameMap.set(key, []);
            frameMap.get(key)!.push(job);
        }

        const result: FrameJobGroup[] = [];
        for (const [timestep, frameJobs] of frameMap) {
            const sorted = this.sortByTimestamp(frameJobs);
            result.push({ timestep, jobs: sorted, overallStatus: this.computeStatus(frameJobs) });
        }

        return result.sort((a, b) => b.timestep - a.timestep);
    }

    private groupJobsByTrajectory(jobs: BaseJob[]): TrajectoryJobGroup[] {
        const trajMap = new Map<string, BaseJob[]>();
        for (const job of jobs) {
            const trajId = job.trajectoryId;
            if (!trajMap.has(trajId)) trajMap.set(trajId, []);
            trajMap.get(trajId)!.push(job);
        }

        const result: TrajectoryJobGroup[] = [];
        for (const [trajectoryId, trajJobs] of trajMap) {
            const sorted = this.sortByTimestamp(trajJobs);
            const completedCount = sorted.filter((j: any) => j.status === 'completed').length;
            const trajectoryName = sorted[0].trajectoryName;
            const latestTimestamp = (sorted[0] as any)?.timestamp || new Date().toISOString();

            result.push({
                trajectoryId,
                trajectoryName,
                frameGroups: this.groupJobsByFrame(sorted),
                latestTimestamp,
                overallStatus: this.computeStatus(sorted),
                completedCount,
                totalCount: sorted.length
            });
        }

        return result.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
    }

    private sortByTimestamp(jobs: BaseJob[]): BaseJob[] {
        return [...jobs].sort((a, b) => {
            const ta = (a as any).timestamp ? new Date((a as any).timestamp).getTime() : 0;
            const tb = (b as any).timestamp ? new Date((b as any).timestamp).getTime() : 0;
            return tb - ta;
        });
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
