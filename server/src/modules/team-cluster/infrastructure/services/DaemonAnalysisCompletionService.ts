import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { IEventBus } from '@shared/application/events/IEventBus';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import IORedis from 'ioredis';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';

const QUEUE_TYPE = 'analysis_processing';
const SESSION_TTL_SECONDS = 86400;
const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const STATUS_TTL_SECONDS = 86400;

interface JobTrajectoryContext {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
};

interface DaemonJobCompletionInput {
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    success: boolean;
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

        // 1. Project job status to Redis for dashboard/socket consumers
        await this.projectJobStatus(jobId, status, teamId, analysisId, trajectoryContext, error);

        // 2. Publish socket event to frontend
        await this.publishJobStatusChanged(jobId, teamId, status, analysisId, trajectoryContext, error);

        // 3. Increment completedFrames on analysis
        if (success) {
            await this.analysisRepo.updateById(analysisId, {
                $inc: { completedFrames: 1 }
            } as Record<string, unknown>).catch((incrementError: unknown) => {
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

    private async projectJobStatus(
        jobId: string,
        status: JobStatus,
        teamId: string,
        analysisId: string,
        trajectoryContext: JobTrajectoryContext,
        error?: string
    ): Promise<void> {
        const metadata: Record<string, unknown> = {
            jobId,
            analysisId,
            status,
            queueType: QUEUE_TYPE
        };
        const statusData: Record<string, unknown> = {
            jobId,
            status,
            teamId,
            analysisId,
            queueType: QUEUE_TYPE,
            metadata,
            timestamp: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

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
            `${JOB_STATUS_KEY_PREFIX}${jobId}`,
            JSON.stringify(statusData),
            'EX',
            STATUS_TTL_SECONDS
        );
        pipeline.sadd(`team:${teamId}:jobs`, jobId);
        await pipeline.exec();
    }

    private async publishJobStatusChanged(
        jobId: string,
        teamId: string,
        status: JobStatus,
        analysisId: string,
        trajectoryContext: JobTrajectoryContext,
        error?: string
    ): Promise<void> {
        const event = new JobStatusChangedEvent({
            jobId,
            teamId,
            status,
            queueType: QUEUE_TYPE,
            metadata: {
                jobId,
                analysisId,
                status,
                queueType: QUEUE_TYPE,
                trajectoryId: trajectoryContext.trajectoryId,
                trajectoryName: trajectoryContext.trajectoryName,
                timestep: trajectoryContext.timestep,
                error
            }
        });

        await this.eventBus.publish(event);
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

    private remainingKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:remaining`;
    }

    private failedKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:failed`;
    }
};
