import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import IORedis from 'ioredis';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';

const ANALYSIS_QUEUE_TYPE = 'analysis_processing';
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';
const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const SESSION_TTL_SECONDS = 86400;
const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const STATUS_TTL_SECONDS = 86400;
const PROJECTED_JOB_SOURCE = 'projected';
const PROJECTED_JOB_BACKING_SOURCE = 'daemon';
const ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE = 'analysis';
const RASTER_PROJECTED_JOB_CLEANUP_SCOPE = 'raster';
const GLB_PROJECTED_JOB_CLEANUP_SCOPE = 'glb';

interface JobTrajectoryContext {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
};

interface DaemonJobCompletionInput {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

interface DaemonRasterJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface DaemonGlbJobStatusInput {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface ProjectedJobStatusInput {
    jobId: string;
    teamId: string;
    status: JobStatus;
    queueType: string;
    cleanupScope: string;
    name?: string;
    analysisId?: string;
    trajectoryContext: JobTrajectoryContext;
    error?: string;
};

@injectable()
export default class DaemonAnalysisCompletionService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepo: IAnalysisRepository,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ) {}

    /**
     * Called by the PluginExecutionRouter after dispatching jobs to the daemon.
     * Initializes a Redis counter so we can track when all jobs have settled.
     */
    async initializeSession(analysisId: string, totalJobs: number): Promise<void> {
        const remainingKey = this.remainingKey(analysisId);
        const failedKey = this.failedKey(analysisId);

        const pipeline = this.redis.pipeline();
        pipeline.set(remainingKey, totalJobs.toString(), 'EX', SESSION_TTL_SECONDS);
        pipeline.del(failedKey);
        await pipeline.exec();

        logger.info(
            `[DaemonAnalysisCompletion] Initialized session for analysis ${analysisId} with ${totalJobs} jobs`
        );
    }

    /**
     * Called when the daemon reports a single job completed or failed.
     * Projects status to Redis, publishes socket events, and handles session drain.
     */
    async handleJobCompletion(input: DaemonJobCompletionInput): Promise<void> {
        const { jobId, analysisId, teamId, success, error } = input;
        const status = success ? JobStatus.Completed : JobStatus.Failed;
        const trajectoryContext = await this.resolveTrajectoryContext(input);
        const name = input.name;

        // 1. Project job status to Redis for dashboard/socket consumers
        await this.projectJobStatus({
            jobId,
            teamId,
            status,
            queueType: ANALYSIS_QUEUE_TYPE,
            cleanupScope: ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE,
            name,
            analysisId,
            trajectoryContext,
            error
        });

        // 2. Publish socket event to frontend
        await this.publishJobStatusChanged({
            jobId,
            teamId,
            status,
            queueType: ANALYSIS_QUEUE_TYPE,
            cleanupScope: ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE,
            name,
            analysisId,
            trajectoryContext,
            error
        });

        // 3. Increment completedFrames on analysis
        if (success) {
            const completedFramesUpdate: Record<string, unknown> = {
                $inc: { completedFrames: 1 }
            };

            await this.analysisRepo.updateById(analysisId, completedFramesUpdate).catch((incrementError: unknown) => {
                logger.warn(
                    { analysisId, err: incrementError },
                    '[DaemonAnalysisCompletion] Failed to increment completedFrames'
                );
            });
        }

        // 4. Record failure if applicable
        if (!success) {
            await this.recordFailure(analysisId);
        }

        // 5. Atomically decrement remaining counter
        const drainResult = await this.decrementAndCheckDrain(analysisId);
        if (!drainResult.drained) {
            return;
        }

        // 6. All jobs settled - finalize analysis
        await this.finalizeAnalysis(analysisId, teamId, drainResult.failedJobs);
    }

    async handleRasterJobStatus(input: DaemonRasterJobStatusInput): Promise<void> {
        const jobId = this.requireRasterJobId(input.jobId);
        const trajectoryContext: JobTrajectoryContext = {
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            timestep: input.timestep
        };

        await this.projectJobStatus({
            jobId,
            teamId: input.teamId,
            status: input.status,
            queueType: RASTER_QUEUE_TYPE,
            cleanupScope: RASTER_PROJECTED_JOB_CLEANUP_SCOPE,
            trajectoryContext,
            error: input.error
        });

        await this.publishJobStatusChanged({
            jobId,
            teamId: input.teamId,
            status: input.status,
            queueType: RASTER_QUEUE_TYPE,
            cleanupScope: RASTER_PROJECTED_JOB_CLEANUP_SCOPE,
            trajectoryContext,
            error: input.error
        });
    }

    /**
     * Called when the daemon reports a GLB conversion job status change.
     * Projects status to Redis, publishes socket events, and handles GLB session drain.
     */
    async handleGlbJobStatus(input: DaemonGlbJobStatusInput): Promise<void> {
        const { jobId, teamId, trajectoryId, status, error } = input;
        const trajectoryContext: JobTrajectoryContext = {
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
            timestep: input.timestep
        };

        // 1. Project job status to Redis for dashboard/socket consumers
        await this.projectJobStatus({
            jobId,
            teamId,
            status,
            queueType: GLB_QUEUE_TYPE,
            cleanupScope: GLB_PROJECTED_JOB_CLEANUP_SCOPE,
            trajectoryContext,
            error
        });

        // 2. Publish socket event to frontend
        await this.publishJobStatusChanged({
            jobId,
            teamId,
            status,
            queueType: GLB_QUEUE_TYPE,
            cleanupScope: GLB_PROJECTED_JOB_CLEANUP_SCOPE,
            trajectoryContext,
            error
        });

        // 3. Only process drain logic for terminal statuses
        const isTerminal = status === JobStatus.Completed || status === JobStatus.Failed;
        if (!isTerminal) {
            return;
        }

        // 4. Record failure if applicable
        if (status === JobStatus.Failed) {
            await this.recordGlbFailure(trajectoryId);
        }

        // 5. Atomically decrement remaining counter
        const drainResult = await this.decrementAndCheckGlbDrain(trajectoryId);
        if (!drainResult.drained) {
            return;
        }

        // 6. All GLB jobs settled - finalize trajectory
        await this.finalizeGlbSession(trajectoryId, teamId, drainResult.failedJobs);
    }

    private async projectJobStatus(input: ProjectedJobStatusInput): Promise<void> {
        const {
            jobId,
            teamId,
            status,
            queueType,
            cleanupScope,
            name,
            analysisId,
            trajectoryContext,
            error
        } = input;
        const timestamp = new Date().toISOString();
        const metadata: Record<string, unknown> = {
            jobId,
            status,
            queueType,
            source: PROJECTED_JOB_SOURCE,
            backingSource: PROJECTED_JOB_BACKING_SOURCE,
            cleanupScope
        };
        const statusData: Record<string, unknown> = {
            jobId,
            status,
            teamId,
            queueType,
            source: PROJECTED_JOB_SOURCE,
            metadata,
            timestamp,
            updatedAt: timestamp
        };

        if (analysisId) {
            metadata.analysisId = analysisId;
            statusData.analysisId = analysisId;
        }

        if (name) {
            metadata.name = name;
            statusData.name = name;
        }

        if (trajectoryContext.trajectoryId) {
            metadata.trajectoryId = trajectoryContext.trajectoryId;
            statusData.trajectoryId = trajectoryContext.trajectoryId;
        }

        if (trajectoryContext.trajectoryName) {
            metadata.trajectoryName = trajectoryContext.trajectoryName;
            statusData.trajectoryName = trajectoryContext.trajectoryName;
        }

        if (typeof trajectoryContext.timestep === 'number') {
            metadata.timestep = trajectoryContext.timestep;
            statusData.timestep = trajectoryContext.timestep;
        }

        if (error) {
            metadata.error = error;
            statusData.error = error;
        }

        const pipeline = this.redis.pipeline();
        pipeline.set(
            this.jobStatusKey(jobId),
            JSON.stringify(statusData),
            'EX',
            STATUS_TTL_SECONDS
        );
        pipeline.sadd(this.teamJobsKey(teamId), jobId);
        pipeline.sadd(this.projectedTeamJobsKey(teamId), jobId);
        pipeline.expire(this.teamJobsKey(teamId), STATUS_TTL_SECONDS);
        pipeline.expire(this.projectedTeamJobsKey(teamId), STATUS_TTL_SECONDS);

        if (analysisId) {
            pipeline.sadd(this.projectedAnalysisJobsKey(analysisId), jobId);
            pipeline.expire(this.projectedAnalysisJobsKey(analysisId), STATUS_TTL_SECONDS);
        }

        await pipeline.exec();
    }

    private async publishJobStatusChanged(input: ProjectedJobStatusInput): Promise<void> {
        const {
            jobId,
            teamId,
            status,
            queueType,
            cleanupScope,
            name,
            analysisId,
            trajectoryContext,
            error
        } = input;
        const event = new JobStatusChangedEvent({
            jobId,
            teamId,
            status,
            queueType,
            metadata: {
                jobId,
                name,
                analysisId,
                status,
                queueType,
                source: PROJECTED_JOB_SOURCE,
                backingSource: PROJECTED_JOB_BACKING_SOURCE,
                cleanupScope,
                trajectoryId: trajectoryContext.trajectoryId,
                trajectoryName: trajectoryContext.trajectoryName,
                timestep: trajectoryContext.timestep,
                error
            }
        });

        await this.eventBus.publish(event);
    }

    private requireRasterJobId(jobId: string): string {
        if (jobId.trim().length === 0) {
            throw new Error('Raster daemon status updates require jobId');
        }

        return jobId;
    }

    private async resolveTrajectoryContext(input: DaemonJobCompletionInput): Promise<JobTrajectoryContext> {
        let trajectoryId = input.trajectoryId;

        if (!trajectoryId) {
            const analysis = await this.analysisRepo.findById(input.analysisId);
            trajectoryId = trajectoryId || analysis?.props.trajectory;
        }

        let trajectoryName: string | undefined;
        if (trajectoryId) {
            const trajectory = await this.trajectoryRepo.findById(trajectoryId);
            trajectoryName = trajectory?.props.name;
        }

        return {
            trajectoryId,
            trajectoryName,
            timestep: input.timestep
        };
    }

    private async recordFailure(analysisId: string): Promise<void> {
        const failedKey = this.failedKey(analysisId);
        await this.redis.incr(failedKey);
        await this.redis.expire(failedKey, SESSION_TTL_SECONDS);
    }

    private async decrementAndCheckDrain(analysisId: string): Promise<{ drained: boolean; failedJobs: number }> {
        const luaScript = `
            local ttl = tonumber(ARGV[1])
            redis.call('EXPIRE', KEYS[1], ttl)

            local remaining = redis.call('DECR', KEYS[1])
            if remaining <= 0 then
                local failedJobs = tonumber(redis.call('GET', KEYS[2]) or '0')
                redis.call('DEL', KEYS[1])
                redis.call('DEL', KEYS[2])
                return {1, failedJobs}
            end
            return {0, 0}
        `;

        const result = await this.redis.eval(
            luaScript,
            2,
            this.remainingKey(analysisId),
            this.failedKey(analysisId),
            SESSION_TTL_SECONDS
        );

        if (!Array.isArray(result) || result.length !== 2) {
            return { drained: false, failedJobs: 0 };
        }

        return {
            drained: result[0] === 1,
            failedJobs: typeof result[1] === 'number' ? result[1] : 0
        };
    }

    private async finalizeAnalysis(analysisId: string, teamId: string, failedJobs: number): Promise<void> {
        const hasFailures = failedJobs > 0;

        if (hasFailures) {
            logger.error(
                `[DaemonAnalysisCompletion] Analysis ${analysisId} completed with ${failedJobs} failed jobs`
            );
            await this.analysisRepo.updateById(analysisId, {
                status: 'failed',
                finishedAt: new Date()
            }).catch(() => {});

            const analysis = await this.analysisRepo.findById(analysisId);
            if (analysis?.props.trajectory) {
                await this.trajectoryRepo.updateById(analysis.props.trajectory, {
                    status: TrajectoryStatus.Failed
                });

                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId: analysis.props.trajectory,
                    teamId,
                    updates: { status: TrajectoryStatus.Failed },
                    updatedAt: new Date()
                }));
            }
            return;
        }

        logger.info(`[DaemonAnalysisCompletion] Analysis ${analysisId} completed successfully (daemon precomputed listings)`);

        // Daemon already precomputed listing rows - skip ListingRowPrecomputationService
        await this.analysisRepo.updateById(analysisId, {
            status: 'completed',
            finishedAt: new Date()
        });

        // Mark trajectory as completed
        const analysis = await this.analysisRepo.findById(analysisId);
        if (analysis?.props.trajectory) {
            await this.trajectoryRepo.updateById(analysis.props.trajectory, {
                status: TrajectoryStatus.Completed
            });

            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId: analysis.props.trajectory,
                teamId,
                updates: { status: TrajectoryStatus.Completed },
                updatedAt: new Date()
            }));
        }
    }

    private async recordGlbFailure(trajectoryId: string): Promise<void> {
        const failedKey = this.glbFailedKey(trajectoryId);
        await this.redis.incr(failedKey);
        await this.redis.expire(failedKey, SESSION_TTL_SECONDS);
    }

    private async decrementAndCheckGlbDrain(trajectoryId: string): Promise<{ drained: boolean; failedJobs: number }> {
        const luaScript = `
            local ttl = tonumber(ARGV[1])
            redis.call('EXPIRE', KEYS[1], ttl)

            local remaining = redis.call('DECR', KEYS[1])
            if remaining <= 0 then
                local failedJobs = tonumber(redis.call('GET', KEYS[2]) or '0')
                redis.call('DEL', KEYS[1])
                redis.call('DEL', KEYS[2])
                return {1, failedJobs}
            end
            return {0, 0}
        `;

        const result = await this.redis.eval(
            luaScript,
            2,
            this.glbRemainingKey(trajectoryId),
            this.glbFailedKey(trajectoryId),
            SESSION_TTL_SECONDS
        );

        if (!Array.isArray(result) || result.length !== 2) {
            return { drained: false, failedJobs: 0 };
        }

        return {
            drained: result[0] === 1,
            failedJobs: typeof result[1] === 'number' ? result[1] : 0
        };
    }

    private async finalizeGlbSession(trajectoryId: string, teamId: string, failedJobs: number): Promise<void> {
        const hasFailures = failedJobs > 0;

        if (hasFailures) {
            logger.error(
                `[DaemonAnalysisCompletion] GLB session for trajectory ${trajectoryId} completed with ${failedJobs} failed jobs`
            );

            await this.trajectoryRepo.updateById(trajectoryId, {
                status: TrajectoryStatus.Failed
            });

            await this.eventBus.publish(new TrajectoryUpdatedEvent({
                trajectoryId,
                teamId,
                updates: { status: TrajectoryStatus.Failed },
                updatedAt: new Date()
            }));

            return;
        }

        logger.info(
            `[DaemonAnalysisCompletion] GLB session for trajectory ${trajectoryId} completed successfully`
        );

        await this.trajectoryRepo.updateById(trajectoryId, {
            status: TrajectoryStatus.Completed
        });

        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: { status: TrajectoryStatus.Completed },
            updatedAt: new Date()
        }));
    }

    private glbRemainingKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:remaining`;
    }

    private glbFailedKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:failed`;
    }

    private remainingKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:remaining`;
    }

    private failedKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:failed`;
    }

    private jobStatusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
    }

    private teamJobsKey(teamId: string): string {
        return `team:${teamId}:jobs`;
    }

    private projectedTeamJobsKey(teamId: string): string {
        return `team:${teamId}:projected-jobs`;
    }

    private projectedAnalysisJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:projected-jobs`;
    }
};
