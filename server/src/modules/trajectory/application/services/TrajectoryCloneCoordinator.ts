import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryCloneJob, { TrajectoryCloneJobProps, TrajectoryCloneJobState } from '@modules/trajectory/domain/entities/trajectory/TrajectoryCloneJob';
import TrajectoryCloneJobRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryCloneJobRepository';
import TrajectoryFrameRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryFrameRepository';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject } from 'tsyringe';

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

const getCloneJobMessage = (job: TrajectoryCloneJob): string => {
    const { totalFrames, copiedFrames } = job.props.stats;
    switch (job.props.state) {
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
            return job.props.errorMessage || 'Clone failed';
        default:
            return 'Clone update';
    }
};

@Singleton()
export default class TrajectoryCloneCoordinator {
    constructor(
        private readonly cloneJobRepository: TrajectoryCloneJobRepository,
        private readonly trajectoryRepository: TrajectoryRepository,
        private readonly trajectoryFrameRepository: TrajectoryFrameRepository,
        private readonly storagePlacementService: StoragePlacementService,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async runPendingJobs(limit = 1): Promise<number> {
        let processed = 0;

        while (processed < limit) {
            const claimed = await this.cloneJobRepository.claimNextRunnable(CLONE_WORKER_ID, CLAIM_TTL_MS);
            if (!claimed) {
                break;
            }

            const renewTimer = setInterval(() => {
                void this.cloneJobRepository.renewClaim(
                    claimed.id,
                    CLONE_WORKER_ID,
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
                await this.cloneJobRepository.releaseClaim(claimed.id, CLONE_WORKER_ID).catch(() => undefined);
            }
            processed += 1;
        }

        return processed;
    }

    async executeJob(jobId: string): Promise<TrajectoryCloneJob> {
        const job = await this.cloneJobRepository.findById(jobId);
        if (!job) {
            throw ApplicationError.notFound('TrajectoryCloneJob::NotFound', 'Trajectory clone job not found');
        }

        if (!OPEN_CLONE_JOB_STATES.includes(job.props.state)) {
            return job;
        }

        const preparingJob = await this.setJobState(job.id, 'preparing', {
            startedAt: job.props.startedAt ?? new Date(),
            errorCode: null,
            errorMessage: null
        }, { publishUpdate: true });

        try {
            const copiedJob = await this.copyFrames(preparingJob);

            await this.trajectoryRepository.updateById(copiedJob.props.destinationTrajectoryId, {
                status: TrajectoryStatus.Completed,
                hasPreview: false,
                updatedAt: new Date()
            });

            const completedJob = await this.setJobState(copiedJob.id, 'completed', {
                finishedAt: new Date()
            }, { publishUpdate: true });

            logger.info(`[TrajectoryCloneCoordinator] Completed clone job=${completedJob.id} source=${completedJob.props.sourceTrajectoryId} destination=${completedJob.props.destinationTrajectoryId}`);
            return completedJob;
        } catch (error) {
            const errorCode = error instanceof ApplicationError ? error.code : 'TrajectoryClone::Failed';
            const errorMessage = error instanceof Error ? error.message : 'Trajectory clone failed';

            await this.trajectoryRepository.updateById(preparingJob.props.destinationTrajectoryId, {
                status: TrajectoryStatus.Failed,
                updatedAt: new Date()
            }).catch(() => undefined);

            const failedJob = await this.setJobState(preparingJob.id, 'failed', {
                finishedAt: new Date(),
                errorCode,
                errorMessage
            }, { publishUpdate: true });

            logger.error({ err: error }, `[TrajectoryCloneCoordinator] Failed clone job=${failedJob.id}`);
            return failedJob;
        }
    }

    private async copyFrames(initialJob: TrajectoryCloneJob): Promise<TrajectoryCloneJob> {
        const sourceTrajectory = await this.trajectoryRepository.findById(initialJob.props.sourceTrajectoryId);
        if (!sourceTrajectory) {
            throw ApplicationError.notFound('Trajectory::NotFound', 'Source trajectory not found');
        }

        const sourceFrames = await this.trajectoryFrameRepository.getFrames(sourceTrajectory.id);
        const totalFrames = sourceFrames.length;

        let currentJob = await this.setJobState(initialJob.id, 'copying', {
            stats: {
                ...initialJob.props.stats,
                totalFrames
            }
        }, { publishUpdate: true });

        if (totalFrames === 0) {
            return currentJob;
        }

        const sourceClusterId = this.requireStorageClusterId(initialJob.props.sourceClusterId, 'source');
        const destinationClusterId = this.requireStorageClusterId(initialJob.props.destinationClusterId, 'destination');
        const sortedFrames = [...sourceFrames].sort((a, b) => a.timestep - b.timestep);

        const cloneResult = await this.teamClusterDaemonClient.command<{
            copiedFrames: number;
            copiedBytes: number;
        }>(
            destinationClusterId,
            ChannelCommands.TrajectoryClone,
            {
                sourceTrajectoryId: initialJob.props.sourceTrajectoryId,
                destinationTrajectoryId: initialJob.props.destinationTrajectoryId,
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
                ...currentJob.props.stats,
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

    private async setJobState(
        jobId: string,
        state: TrajectoryCloneJobState,
        data: Partial<TrajectoryCloneJobProps> = {},
        options: { publishUpdate?: boolean } = {}
    ): Promise<TrajectoryCloneJob> {
        const updated = await this.cloneJobRepository.updateRuntimeState(jobId, {
            ...data,
            state,
            updatedAt: new Date()
        });

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

    async publishJobProjection(job: TrajectoryCloneJob): Promise<void> {
        try {
            const destinationTrajectory = await this.trajectoryRepository.findById(
                job.props.destinationTrajectoryId,
                { select: ['name'] }
            );

            await this.eventBus.publish(new JobStatusChangedEvent({
                jobId: job.id,
                teamId: job.props.team,
                status: mapCloneStateToJobStatus(job.props.state),
                queueType: TRAJECTORY_CLONE_QUEUE_TYPE,
                name: 'Trajectory Clone',
                message: getCloneJobMessage(job),
                trajectoryId: job.props.destinationTrajectoryId,
                trajectoryName: destinationTrajectory?.props.name || `Trajectory ${job.props.destinationTrajectoryId}`,
                source: 'projected',
                cleanupScope: 'trajectory-clone',
                cloneJobId: job.id,
                cloneState: job.props.state,
                sourceTrajectoryId: job.props.sourceTrajectoryId,
                destinationTrajectoryId: job.props.destinationTrajectoryId,
                sourceClusterId: job.props.sourceClusterId,
                destinationClusterId: job.props.destinationClusterId,
                totalFrames: job.props.stats.totalFrames,
                copiedFrames: job.props.stats.copiedFrames,
                copiedBytes: job.props.stats.copiedBytes,
                ...(job.props.errorMessage ? { error: job.props.errorMessage } : {})
            }));
        } catch (error) {
            logger.warn({ err: error }, `[TrajectoryCloneCoordinator] Failed to publish projection for job=${job.id}`);
        }
    }

    ensureDestinationPlacement(trajectoryId: string): Promise<void> {
        return this.storagePlacementService.ensurePlacement('trajectory', trajectoryId).then(() => undefined);
    }
}
