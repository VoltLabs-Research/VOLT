import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { JobStatus } from '@shared/contracts/types';
import { DOMAIN_EVENTS } from '@shared/contracts/events';
import { GenericDomainEvent } from '@shared/domain/events/GenericDomainEvent';
import storagePlacementService, { StoragePlacementService } from '@modules/cluster/services/StoragePlacementService';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import logger from '@shared/infrastructure/logger';

import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import TrajectoryFrameModel from '@modules/trajectory/models/trajectory/TrajectoryFrameModel';
import TrajectoryCloneJobModel, {
    type TrajectoryCloneJobDocument,
    type TrajectoryCloneJobProps,
    type TrajectoryCloneJobState
} from '@modules/trajectory/models/trajectory/TrajectoryCloneJobModel';

const TRAJECTORY_CLONE_QUEUE_TYPE = 'trajectory_clone';
const CLAIM_TTL_MS = 5 * 60 * 1000;
const CLAIM_RENEW_INTERVAL_MS = 60 * 1000;
const CLONE_WORKER_ID = `${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const OPEN_CLONE_JOB_STATES: TrajectoryCloneJobState[] = [
    'queued',
    'preparing',
    'copying'
];

const mapCloneStateToJobStatus = (state: TrajectoryCloneJobState): JobStatus => {
    switch (state) {
        case 'completed':
            return JobStatus.Completed;
        case 'failed':
            return JobStatus.Failed;
        case 'queued':
            return JobStatus.Queued;
        default:
            return JobStatus.Running;
    }
};

const getCloneJobMessage = (job: TrajectoryCloneJobDocument): string => {
    const { totalFrames, copiedFrames } = job.stats;
    switch (job.state) {
        case 'queued':
            return 'Clone queued';
        case 'preparing':
            return 'Preparing trajectory clone';
        case 'copying':
            return totalFrames > 0
                ? `Copying frames ${copiedFrames}/${totalFrames}`
                : 'Copying frames';
        case 'completed':
            return 'Trajectory cloned';
        case 'failed':
            return job.errorMessage || 'Clone failed';
        default:
            return 'Clone update';
    }
};

export class TrajectoryCloneCoordinator {
    private readonly storagePlacementService: StoragePlacementService = storagePlacementService;

        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

        private readonly eventBus = eventBus;

    async runPendingJobs(limit = 1): Promise<number> {
        let processed = 0;

        while (processed < limit) {
            const claimed = await this.claimNextRunnable();
            if (!claimed) {
                break;
            }

            const renewTimer = setInterval(() => {
                void this.renewClaim(
                    claimed.id,
                    CLAIM_TTL_MS
                ).catch((error) => {
                    logger.warn({ error, jobId: claimed.id }, '[TrajectoryCloneCoordinator] Failed to renew claim');
                });
            }, CLAIM_RENEW_INTERVAL_MS);
            renewTimer.unref();

            try {
                await this.executeJob(claimed.id);
            } finally {
                clearInterval(renewTimer);
                await this.releaseClaim(claimed.id).catch(() => undefined);
            }
            processed += 1;
        }

        return processed;
    }

    async executeJob(jobId: string): Promise<TrajectoryCloneJobDocument> {
        const job = await TrajectoryCloneJobModel.findById(jobId);
        if (!job) {
            throw ApplicationError.notFound('TrajectoryCloneJob::NotFound', 'Trajectory clone job not found');
        }

        if (!OPEN_CLONE_JOB_STATES.includes(job.state)) {
            return job;
        }

        const preparingJob = await this.setJobState(job.id, 'preparing', {
            startedAt: job.startedAt ?? new Date(),
            errorCode: null,
            errorMessage: null
        }, { publishUpdate: true });

        try {
            const copiedJob = await this.copyFrames(preparingJob);

            await TrajectoryModel.findByIdAndUpdate(copiedJob.destinationTrajectoryId, {
                $set: {
                    status: TrajectoryStatus.Completed,
                    hasPreview: false,
                    updatedAt: new Date()
                }
            }).exec();

            const completedJob = await this.setJobState(copiedJob.id, 'completed', {
                finishedAt: new Date()
            }, { publishUpdate: true });

            logger.info(`[TrajectoryCloneCoordinator] Completed clone job=${completedJob.id} source=${completedJob.sourceTrajectoryId} destination=${completedJob.destinationTrajectoryId}`);
            return completedJob;
        } catch (error) {
            const errorCode = error instanceof ApplicationError ? error.code : 'TrajectoryClone::Failed';
            const errorMessage = error instanceof Error ? error.message : 'Trajectory clone failed';

            await TrajectoryModel.findByIdAndUpdate(preparingJob.destinationTrajectoryId, {
                $set: {
                    status: TrajectoryStatus.Failed,
                    updatedAt: new Date()
                }
            }).exec().catch(() => undefined);

            const failedJob = await this.setJobState(preparingJob.id, 'failed', {
                finishedAt: new Date(),
                errorCode,
                errorMessage
            }, { publishUpdate: true });

            logger.error({ err: error }, `[TrajectoryCloneCoordinator] Failed clone job=${failedJob.id}`);
            return failedJob;
        }
    }

    private async copyFrames(initialJob: TrajectoryCloneJobDocument): Promise<TrajectoryCloneJobDocument> {
        const sourceTrajectory = await TrajectoryModel.findById(initialJob.sourceTrajectoryId);
        if (!sourceTrajectory) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Source trajectory not found');
        }

        const sourceFrames = await TrajectoryFrameModel.find({ trajectoryId: sourceTrajectory._id })
            .select('timestep')
            .sort({ timestep: 1 })
            .lean()
            .exec();
        const totalFrames = sourceFrames.length;

        let currentJob = await this.setJobState(initialJob.id, 'copying', {
            stats: {
                ...initialJob.stats,
                totalFrames
            }
        }, { publishUpdate: true });

        if (totalFrames === 0) {
            return currentJob;
        }

        const sourceClusterId = this.requireStorageClusterId(initialJob.sourceClusterId, 'source');
        const destinationClusterId = this.requireStorageClusterId(initialJob.destinationClusterId, 'destination');
        const sortedFrames = [...sourceFrames].sort((a, b) => a.timestep - b.timestep);

        const cloneResult = await this.teamClusterDaemonClient.command<{
            copiedFrames: number;
            copiedBytes: number;
        }>(
            destinationClusterId,
            ChannelCommands.TrajectoryClone,
            {
                sourceTrajectoryId: initialJob.sourceTrajectoryId,
                destinationTrajectoryId: initialJob.destinationTrajectoryId,
                sourceClusterId,
                destinationClusterId,
                frames: sortedFrames.map((frame) => ({
                    timestep: frame.timestep
                }))
            },
            { timeoutClass: 'long-running-control-plane' }
        );

        currentJob = await this.setJobState(currentJob.id, 'copying', {
            stats: {
                ...currentJob.stats,
                copiedFrames: cloneResult.copiedFrames,
                copiedBytes: cloneResult.copiedBytes
            }
        }, { publishUpdate: true });

        return currentJob;
    }

    private requireStorageClusterId(clusterId: string | null | undefined, role: 'source' | 'destination'): string {
        if (clusterId && clusterId.trim().length > 0) {
            return clusterId;
        }

        throw ApplicationError.conflict(
            'TrajectoryClone::StorageClusterRequired',
            `Trajectory clone ${role} storage cluster is required`
        );
    }

    private async claimNextRunnable(): Promise<TrajectoryCloneJobDocument | null> {
        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + CLAIM_TTL_MS);

        return TrajectoryCloneJobModel.findOneAndUpdate(
            {
                state: { $in: OPEN_CLONE_JOB_STATES },
                $or: [
                    { claimedBy: null },
                    { claimedBy: { $exists: false } },
                    { claimExpiresAt: null },
                    { claimExpiresAt: { $lte: now } }
                ]
            },
            {
                $set: {
                    claimedBy: CLONE_WORKER_ID,
                    claimExpiresAt
                }
            },
            {
                new: true,
                sort: { updatedAt: 1, createdAt: 1 }
            }
        ).exec();
    }

    private async renewClaim(jobId: string, claimTtlMs: number): Promise<boolean> {
        const claimExpiresAt = new Date(Date.now() + claimTtlMs);
        const result = await TrajectoryCloneJobModel.updateOne(
            { _id: jobId, claimedBy: CLONE_WORKER_ID },
            { $set: { claimExpiresAt } }
        ).exec();

        return result.modifiedCount > 0;
    }

    private async releaseClaim(jobId: string): Promise<void> {
        await TrajectoryCloneJobModel.updateOne(
            { _id: jobId, claimedBy: CLONE_WORKER_ID },
            { $set: { claimedBy: null, claimExpiresAt: null } }
        ).exec();
    }

    private async setJobState(
        jobId: string,
        state: TrajectoryCloneJobState,
        data: Partial<TrajectoryCloneJobProps> = {},
        options: { publishUpdate?: boolean } = {}
    ): Promise<TrajectoryCloneJobDocument> {
        const updated = await TrajectoryCloneJobModel.findByIdAndUpdate(
            jobId,
            {
                $set: {
                    ...data,
                    state,
                    updatedAt: new Date()
                }
            },
            { new: true }
        ).exec();

        if (!updated) {
            throw ApplicationError.notFound(
                'TrajectoryCloneJob::NotFound',
                'Trajectory clone job not found during update'
            );
        }

        if (options.publishUpdate) {
            await this.publishJobProjection(updated);
        }

        return updated;
    }

    async publishJobProjection(job: TrajectoryCloneJobDocument): Promise<void> {
        try {
            const destinationTrajectory = await TrajectoryModel.findById(
                job.destinationTrajectoryId,
                'name'
            );

            await this.eventBus.publish(new GenericDomainEvent(DOMAIN_EVENTS.JobStatusChanged, {
                jobId: job.id,
                teamId: job.team.toString(),
                status: mapCloneStateToJobStatus(job.state),
                queueType: TRAJECTORY_CLONE_QUEUE_TYPE,
                name: 'Trajectory Clone',
                message: getCloneJobMessage(job),
                trajectoryId: job.destinationTrajectoryId,
                trajectoryName: destinationTrajectory?.name || `Trajectory ${job.destinationTrajectoryId}`,
                source: 'projected',
                cleanupScope: 'trajectory-clone',
                cloneJobId: job.id,
                cloneState: job.state,
                sourceTrajectoryId: job.sourceTrajectoryId,
                destinationTrajectoryId: job.destinationTrajectoryId,
                sourceClusterId: job.sourceClusterId,
                destinationClusterId: job.destinationClusterId,
                totalFrames: job.stats.totalFrames,
                copiedFrames: job.stats.copiedFrames,
                copiedBytes: job.stats.copiedBytes,
                ...(job.errorMessage ? { error: job.errorMessage } : {})
            }));
        } catch (error) {
            logger.warn({ err: error }, `[TrajectoryCloneCoordinator] Failed to publish projection for job=${job.id}`);
        }
    }

    ensureDestinationPlacement(trajectoryId: string): Promise<void> {
        return this.storagePlacementService.ensurePlacement('trajectory', trajectoryId).then(() => undefined);
    }
}

export default new TrajectoryCloneCoordinator();
