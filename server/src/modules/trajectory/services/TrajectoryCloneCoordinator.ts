import { ErrorCodes } from '@core/constants/error-codes';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

import { In, IsNull, LessThanOrEqual } from 'typeorm';
import Trajectory from '@modules/trajectory/models/Trajectory';
import TrajectoryFrame from '@modules/trajectory/models/TrajectoryFrame';
import TrajectoryCloneJob from '@modules/trajectory/models/TrajectoryCloneJob';
import { TrajectoryCloneJobState } from '@modules/trajectory/contracts/trajectory-clone-job';

const TRAJECTORY_CLONE_QUEUE_TYPE = 'trajectory_clone';
const CLAIM_TTL_MS = 5 * 60 * 1000;
const CLAIM_RENEW_INTERVAL_MS = 60 * 1000;
const CLONE_WORKER_ID = `${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const OPEN_CLONE_JOB_STATES: TrajectoryCloneJobState[] = [
    TrajectoryCloneJobState.Queued,
    TrajectoryCloneJobState.Preparing,
    TrajectoryCloneJobState.Copying
];

const mapCloneStateToJobStatus = (state: TrajectoryCloneJobState): JobStatus => {
    switch(state){
        case TrajectoryCloneJobState.Completed:
            return JobStatus.Completed;
        case TrajectoryCloneJobState.Failed:
            return JobStatus.Failed;
        case TrajectoryCloneJobState.Queued:
            return JobStatus.Queued;
        default:
            return JobStatus.Running;
    }
};

const getCloneJobMessage = (job: TrajectoryCloneJob): string => {
    const { totalFrames, copiedFrames } = job.stats;
    switch(job.state){
        case TrajectoryCloneJobState.Queued:
            return 'Clone queued';
        case TrajectoryCloneJobState.Preparing:
            return 'Preparing trajectory clone';
        case TrajectoryCloneJobState.Copying:
            return totalFrames > 0
                ? `Copying frames ${copiedFrames}/${totalFrames}`
                : 'Copying frames';
        case TrajectoryCloneJobState.Completed:
            return 'Trajectory cloned';
        case TrajectoryCloneJobState.Failed:
            return job.errorMessage || 'Clone failed';
        default:
            return 'Clone update';
    }
};

class TrajectoryCloneCoordinator{
    private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    private readonly eventBus = eventBus;

    async runPendingJobs(limit = 1): Promise<number>{
        let processed = 0;

        while(processed < limit){
            const claimed = await this.claimNextRunnable();
            if(!claimed){
                break;
            }

            const renewTimer = setInterval(() => {
                void this.renewClaim(claimed.id).catch((error) => {
                    logger.warn({
                        error,
                        jobId: claimed.id
                    }, '[TrajectoryCloneCoordinator] Failed to renew claim');
                });
            }, CLAIM_RENEW_INTERVAL_MS);
            renewTimer.unref();

            try{
                await this.executeJob(claimed.id);
            }finally{
                clearInterval(renewTimer);
                await this.releaseClaim(claimed.id).catch(() => undefined);
            }
            processed += 1;
        }

        return processed;
    }

    async executeJob(jobId: string): Promise<TrajectoryCloneJob>{
        const job = await TrajectoryCloneJob.findOneBy({ id: jobId });
        if(!job){
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_CLONE_JOB_NOT_FOUND, 'Trajectory clone job not found');
        }

        if(!OPEN_CLONE_JOB_STATES.includes(job.state)){
            return job;
        }

        const preparingJob = await this.setJobState(job.id, TrajectoryCloneJobState.Preparing, {
            startedAt: job.startedAt ?? new Date(),
            errorCode: null,
            errorMessage: null
        });

        try{
            const copiedJob = await this.copyFrames(preparingJob);

            await this.updateTrajectory(copiedJob.destinationTrajectoryId, {
                status: TrajectoryStatus.Completed,
                hasPreview: false
            });

            const completedJob = await this.setJobState(copiedJob.id, TrajectoryCloneJobState.Completed, {
                finishedAt: new Date()
            });

            logger.info(`[TrajectoryCloneCoordinator] Completed clone job=${completedJob.id} source=${completedJob.sourceTrajectoryId} destination=${completedJob.destinationTrajectoryId}`);
            return completedJob;
        }catch(error){
            const errorCode = error instanceof ApplicationError ? error.code : 'TrajectoryClone::Failed';
            const errorMessage = error instanceof Error ? error.message : 'Trajectory clone failed';

            await this.updateTrajectory(preparingJob.destinationTrajectoryId, { status: TrajectoryStatus.Failed })
                .catch(() => undefined);

            const failedJob = await this.setJobState(preparingJob.id, TrajectoryCloneJobState.Failed, {
                finishedAt: new Date(),
                errorCode,
                errorMessage
            });

            logger.error({ err: error }, `[TrajectoryCloneCoordinator] Failed clone job=${failedJob.id}`);
            return failedJob;
        }
    }

    private async updateTrajectory(trajectoryId: string, patch: Partial<Trajectory>): Promise<void>{
        const trajectory = await Trajectory.findOneBy({ id: trajectoryId });
        if(!trajectory) return;
        await Object.assign(trajectory, patch).save();
    }

    private async copyFrames(initialJob: TrajectoryCloneJob): Promise<TrajectoryCloneJob>{
        const sourceTrajectory = await Trajectory.findOneBy({ id: initialJob.sourceTrajectoryId });
        if(!sourceTrajectory){
            throw ApplicationError.notFound(ErrorCodes.TRAJECTORY_NOT_FOUND, 'Source trajectory not found');
        }

        const sourceFrames = await TrajectoryFrame.find({
            where: { trajectoryId: sourceTrajectory.id },
            select: { timestep: true },
            order: { timestep: 'ASC' }
        });
        const totalFrames = sourceFrames.length;

        let currentJob = await this.setJobState(initialJob.id, TrajectoryCloneJobState.Copying, {
            stats: {
                ...initialJob.stats,
                totalFrames
            }
        });

        if(totalFrames === 0){
            return currentJob;
        }

        const sourceClusterId = initialJob.sourceClusterId;
        if(!sourceClusterId){
            throw ApplicationError.conflict(
                ErrorCodes.TRAJECTORY_CLONE_STORAGE_CLUSTER_REQUIRED,
                'Trajectory clone source storage cluster is required'
            );
        }

        const destinationClusterId = initialJob.destinationClusterId;
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

        currentJob = await this.setJobState(currentJob.id, TrajectoryCloneJobState.Copying, {
            stats: {
                ...currentJob.stats,
                copiedFrames: cloneResult.copiedFrames,
                copiedBytes: cloneResult.copiedBytes
            }
        });

        return currentJob;
    }

    private async claimNextRunnable(): Promise<TrajectoryCloneJob | null>{
        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + CLAIM_TTL_MS);

        for(;;){
            const candidate = await TrajectoryCloneJob.findOne({
                where: [
                    {
                        state: In(OPEN_CLONE_JOB_STATES),
                        claimedBy: IsNull()
                    },
                    {
                        state: In(OPEN_CLONE_JOB_STATES),
                        claimExpiresAt: IsNull()
                    },
                    {
                        state: In(OPEN_CLONE_JOB_STATES),
                        claimExpiresAt: LessThanOrEqual(now)
                    }
                ],
                order: {
                    updatedAt: 'ASC',
                    createdAt: 'ASC'
                },
                select: { id: true }
            });

            if(!candidate){
                return null;
            }

            const claim = await TrajectoryCloneJob.createQueryBuilder()
                .update()
                .set({
                    claimedBy: CLONE_WORKER_ID,
                    claimExpiresAt
                })
                .where('id = :id', { id: candidate.id })
                .andWhere('state IN (:...states)', { states: OPEN_CLONE_JOB_STATES })
                .andWhere('(claimedBy IS NULL OR claimExpiresAt IS NULL OR claimExpiresAt <= :now)', { now })
                .execute();

            if(claim.affected){
                return TrajectoryCloneJob.findOneBy({ id: candidate.id });
            }
        }
    }

    private async renewClaim(jobId: string): Promise<boolean>{
        const claimExpiresAt = new Date(Date.now() + CLAIM_TTL_MS);
        const result = await TrajectoryCloneJob.update({
            id: jobId,
            claimedBy: CLONE_WORKER_ID
        }, { claimExpiresAt });

        return (result.affected ?? 0) > 0;
    }

    private async releaseClaim(jobId: string): Promise<void>{
        await TrajectoryCloneJob.update({
            id: jobId,
            claimedBy: CLONE_WORKER_ID
        }, {
            claimedBy: null,
            claimExpiresAt: null
        });
    }

    private async setJobState(
        jobId: string,
        state: TrajectoryCloneJobState,
        data: Partial<TrajectoryCloneJob> = {}
    ): Promise<TrajectoryCloneJob>{
        const job = await TrajectoryCloneJob.findOneBy({ id: jobId });
        if(!job){
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_CLONE_JOB_NOT_FOUND,
                'Trajectory clone job not found during update'
            );
        }

        const updated = await Object.assign(job, data, { state }).save();
        await this.publishJobProjection(updated);

        return updated;
    }

    async publishJobProjection(job: TrajectoryCloneJob): Promise<void>{
        try{
            const destinationTrajectory = await Trajectory.findOne({
                where: { id: job.destinationTrajectoryId },
                select: {
                    id: true,
                    name: true
                }
            });

            await this.eventBus.emit('job.status.changed', {
                jobId: job.id,
                teamId: job.team,
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
            });
        }catch(error){
            logger.warn({ err: error }, `[TrajectoryCloneCoordinator] Failed to publish projection for job=${job.id}`);
        }
    }
}

export default new TrajectoryCloneCoordinator();
