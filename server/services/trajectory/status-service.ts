import { Trajectory } from '@/models';
import { createRedisClient } from '@/config/redis';
import { BaseProcessingQueue } from '@/queues/base';
import logger from '@/logger';
import IORedis from 'ioredis';
import {
    getTrajectoryProcessingQueue,
    getAnalysisQueue,
    getRasterizerQueue,
    getSSHImportQueue,
    getCloudUploadQueue
} from '@/queues';

export interface StatusUpdateContext {
    trajectoryId: string;
    teamId: string;
};

class TrajectoryStatusService {
    private redis: IORedis;

    constructor() {
        this.redis = createRedisClient();
    }

    /**
     * Updates trajectory status by checking all queues for active jobs.
     */
    async updateFromJobStatus(context: StatusUpdateContext): Promise<boolean> {
        const { trajectoryId, teamId } = context;
        try {
            const queues = this.getAllQueues();
            // Default status if nothing is running
            let newStatus = 'completed';

            for (const queue of queues) {
                const hasActive = await queue.hasActiveJobsForTrajectory(trajectoryId);
                if (!hasActive) continue;

                // Found active jobs. Then trajectory.status = mappedStatus for 'running'.
                newStatus = queue.getMappedStatus('running');
                break;
            }

            const trajectory = await Trajectory.findById(trajectoryId);
            if (!trajectory) return false;

            if (trajectory.status !== newStatus) {
                const updated = await Trajectory.findByIdAndUpdate(
                    trajectoryId,
                    { status: newStatus },
                    { new: true }
                );

                // TODO: throw trajectory not found
                if (!updated) return false;
                await this.publishStatusUpdate(trajectoryId, newStatus, teamId, updated.updatedAt);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`[TrajectoryStatusService] Failed to update ${trajectoryId}: ${error}`);
            return false;
        }
    }

    private getAllQueues(): BaseProcessingQueue<any>[] {
        return [
            getAnalysisQueue(),
            getRasterizerQueue(),
            getTrajectoryProcessingQueue(),
            getSSHImportQueue(),
            getCloudUploadQueue()
        ];
    }

    private async publishStatusUpdate(trajectoryId: string, status: string, teamId: string, updatedAt: Date) {
        await this.redis.publish('trajectory_updates', JSON.stringify({
            trajectoryId,
            status,
            teamId,
            updatedAt: updatedAt || new Date(),
            timestamp: new Date().toISOString()
        }));
    }
};

export default new TrajectoryStatusService();