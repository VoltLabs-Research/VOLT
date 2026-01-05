/**
 * TrajectoryStatusService - Centralized trajectory status management.
 * 
 * This service handles all trajectory status transitions based on job events.
 * It encapsulates the logic that was previously embedded in BaseProcessingQueue,
 * making it reusable and easier to test.
 */

import { Trajectory } from '@/models';
import { Queues } from '@/constants/queues';
import { createRedisClient } from '@config/redis';
import logger from '@/logger';
import IORedis from 'ioredis';
import { Analysis } from '@/models';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';

export interface StatusUpdateContext {
    trajectoryId: string;
    teamId: string;
    sessionId?: string;
    jobStatus: string;
    queueType: string;
    timestep?: number;
}

class TrajectoryStatusService {
    private redis: IORedis;

    constructor() {
        this.redis = createRedisClient();
    }

    /**
     * Map job status to trajectory status based on queue type.
     * Returns null if the job status should not affect trajectory status.
     */
    mapJobStatusToTrajectoryStatus(jobStatus: string, queueType: string): string | null {
        // Cloud upload jobs should NOT affect trajectory status
        if (queueType.includes(Queues.CLOUD_UPLOAD)) {
            return null;
        }

        if (queueType.includes(Queues.ANALYSIS_PROCESSING)) {
            switch (jobStatus) {
                case 'queued':
                case 'waiting':
                    return 'queued';
                case 'running':
                    return 'analyzing';
                case 'completed':
                    return 'completed';
                case 'failed':
                    return 'failed';
                default:
                    return null;
            }
        }

        if (queueType.includes(Queues.RASTERIZER)) {
            switch (jobStatus) {
                case 'queued':
                case 'waiting':
                    return 'rendering';
                case 'running':
                    return 'rendering';
                case 'completed':
                    return 'completed';
                case 'failed':
                    return 'failed';
                default:
                    return null;
            }
        }

        // Trajectory processing (default)
        switch (jobStatus) {
            case 'queued':
            case 'waiting':
                return 'queued';
            case 'running':
                return 'processing';
            case 'completed':
                // When trajectory processing completes, it transitions to rendering
                return 'rendering';
            case 'failed':
                return 'failed';
            default:
                return null;
        }
    }

    /**
     * Update trajectory status based on job status change.
     * Handles deduplication logic to prevent redundant updates.
     */
    async updateFromJobStatus(context: StatusUpdateContext): Promise<boolean> {
        const { trajectoryId, teamId, sessionId, jobStatus, queueType } = context;

        const trajectoryStatus = this.mapJobStatusToTrajectoryStatus(jobStatus, queueType);
        if (!trajectoryStatus) {
            return false;
        }

        try {
            const trajectory = await Trajectory.findById(trajectoryId);
            if (!trajectory) {
                logger.warn(`[TrajectoryStatusService] Trajectory not found: ${trajectoryId}`);
                return false;
            }

            const currentStatus = trajectory.status;
            let shouldUpdate = false;

            // Determine if we should update based on current and new status
            if (jobStatus === 'queued' &&
                currentStatus !== 'processing' &&
                currentStatus !== 'rendering' &&
                currentStatus !== 'completed') {
                shouldUpdate = true;
            } else if (jobStatus === 'running') {
                if (trajectoryStatus === 'analyzing') {
                    // Analysis can always update status
                    shouldUpdate = true;
                } else if (trajectoryStatus === 'rendering' && queueType.includes(Queues.RASTERIZER)) {
                    // Rasterizer running should always trigger an update to notify frontend
                    shouldUpdate = true;
                } else if (currentStatus !== 'rendering' && currentStatus !== 'completed') {
                    shouldUpdate = await this.checkFirstRunningJob(sessionId);
                }
            } else if (jobStatus === 'completed' && trajectoryStatus === 'rendering') {
                // Main pipeline completion
                shouldUpdate = await this.checkFirstCompletedJob(sessionId);
            } else if (jobStatus === 'completed' &&
                trajectoryStatus === 'completed' &&
                currentStatus !== 'completed') {
                // Rasterizer or analysis final completion
                if (queueType.includes(Queues.ANALYSIS_PROCESSING)) {
                    // Verifying if there are any pending analyses for this trajectory
                    const pendingAnalyses = await Analysis.exists({
                        trajectory: trajectoryId,
                        finishedAt: { $exists: false }
                    });

                    if (pendingAnalyses) {
                        logger.debug(`[TrajectoryStatusService] Trajectory ${trajectoryId} has pending analyses. Skipping 'completed' status update.`);
                        shouldUpdate = false;
                    } else {
                        shouldUpdate = true;
                    }
                } else {
                    shouldUpdate = true;
                }
            } else if (jobStatus === 'failed' && currentStatus !== 'failed') {
                shouldUpdate = true;
            }

            if (shouldUpdate && trajectoryStatus === 'completed' && jobStatus === 'completed') {
                // If we are about to mark as completed, wait for GLB availability first (background)
                // We only do this if it's the final rasterization step (Queues.RASTERIZER) or similar final step
                // Actually, ensure we have the timestep
                if (queueType.includes(Queues.RASTERIZER) && context.timestep !== undefined) {
                    this.checkGLBAndFinalize(trajectoryId, teamId, context.timestep, trajectoryStatus);
                    return false; // Defer update
                }
            }

            if (shouldUpdate) {
                const updatedTrajectory = await Trajectory.findByIdAndUpdate(
                    trajectoryId,
                    { status: trajectoryStatus },
                    { new: true }
                );

                if (updatedTrajectory && teamId) {
                    await this.publishStatusUpdate(trajectoryId, trajectoryStatus, teamId, updatedTrajectory.updatedAt);
                }

                logger.debug(`[TrajectoryStatusService] Updated ${trajectoryId}: ${currentStatus} -> ${trajectoryStatus}`);
                return true;
            }

            return false;
        } catch (error) {
            logger.error(`[TrajectoryStatusService] Failed to update ${trajectoryId}: ${error}`);
            return false;
        }
    }

    /**
     * Check if this is the first running job for a session.
     * Used to prevent multiple status updates for the same session.
     */
    private async checkFirstRunningJob(sessionId?: string): Promise<boolean> {
        if (!sessionId) return true;

        const sessionRunningKey = `${sessionId}:first_running_job`;
        const alreadyRunning = await this.redis.get(sessionRunningKey);

        if (alreadyRunning) {
            return false;
        }

        await this.redis.setex(sessionRunningKey, 86400, '1');
        return true;
    }

    /**
     * Check if this is the first completed job for a session.
     */
    private async checkFirstCompletedJob(sessionId?: string): Promise<boolean> {
        if (!sessionId) return false;

        const sessionCompleteKey = `${sessionId}:first_complete_job`;
        const alreadyCompleted = await this.redis.get(sessionCompleteKey);

        if (alreadyCompleted) {
            return false;
        }

        await this.redis.setex(sessionCompleteKey, 86400, '1');
        return true;
    }

    /**
     * Publish trajectory status update to Redis for real-time notifications.
     */
    private async publishStatusUpdate(
        trajectoryId: string,
        status: string,
        teamId: string,
        updatedAt?: Date
    ): Promise<void> {
        await this.redis.publish('trajectory_updates', JSON.stringify({
            trajectoryId,
            status,
            teamId,
            updatedAt: updatedAt || new Date(),
            timestamp: new Date().toISOString()
        }));
    }

    /**
     * Polls MinIO for the GLB file and only finalizes status once available.
     */
    private async checkGLBAndFinalize(
        trajectoryId: string,
        teamId: string,
        timestep: number,
        targetStatus: string
    ): Promise<void> {
        const glbPath = `trajectory-${trajectoryId}/previews/timestep-${timestep}.glb`;

        // Fire and forget polling
        (async () => {
            logger.info(`[TrajectoryStatusService] Waiting for GLB availability: ${glbPath}`);
            const startWait = Date.now();

            while (true) {
                try {
                    // Check if object exists
                    await storage.stat(SYS_BUCKETS.MODELS, glbPath);
                    logger.info(`[TrajectoryStatusService] GLB found for ${trajectoryId} after ${Date.now() - startWait}ms`);
                    break;
                } catch (e) {
                    // Not found yet, wait and retry
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Once found, proceed with DB update and notification
            try {
                const updatedTrajectory = await Trajectory.findByIdAndUpdate(
                    trajectoryId,
                    { status: targetStatus },
                    { new: true }
                );

                if (updatedTrajectory && teamId) {
                    await this.publishStatusUpdate(trajectoryId, targetStatus, teamId, updatedTrajectory.updatedAt);
                }

                logger.info(`[TrajectoryStatusService] Finalized status for ${trajectoryId} -> ${targetStatus}`);
            } catch (err) {
                logger.error(`[TrajectoryStatusService] Failed to finalize status for ${trajectoryId}: ${err}`);
            }
        })();
    }
}

export default new TrajectoryStatusService();
