import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { resolveAnalysisComputeClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import IORedis from 'ioredis';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';

const ANALYSIS_QUEUE_TYPE = 'analysis_processing';
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';
const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const ARTIFACT_UPLOAD_QUEUE_TYPE = 'artifact_upload';
const SESSION_TTL_SECONDS = 86400;
const PROJECTED_JOB_SOURCE = 'projected';
const PROJECTED_JOB_BACKING_SOURCE = 'daemon';
const ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE = 'analysis';
const RASTER_PROJECTED_JOB_CLEANUP_SCOPE = 'raster';
const GLB_PROJECTED_JOB_CLEANUP_SCOPE = 'glb';
const ARTIFACT_UPLOAD_PROJECTED_JOB_CLEANUP_SCOPE = 'artifact-upload';
const SSH_IMPORT_PROJECTED_JOB_CLEANUP_SCOPE = 'ssh-import';
const SSH_IMPORT_QUEUE_TYPE = 'ssh_import';

interface JobTrajectoryContext {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
};

interface DaemonJobCompletionInput {
    teamClusterId: string;
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
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface DaemonGlbJobStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface DaemonAnalysisJobStatusInput {
    teamClusterId: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface DaemonSshImportJobStatusInput {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: JobStatus;
    error?: string;
};

interface DaemonArtifactUploadJobStatusInput {
    teamClusterId: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface QueuedJobNotification {
    jobId: string;
    name: string;
    teamId: string;
    timestep: number;
    trajectoryId: string;
    trajectoryName?: string;
    analysisId: string;
    queueType: string;
};

interface QueuedDaemonJobNotification {
    jobId: string;
    teamId: string;
    queueType: string;
    name?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
};

interface ProjectedJobStatusInput {
    jobId: string;
    teamId: string;
    teamClusterId?: string;
    status: JobStatus;
    queueType: string;
    cleanupScope: string;
    name?: string;
    analysisId?: string;
    trajectoryContext: JobTrajectoryContext;
    error?: string;
};

interface ResolvedTrajectoryOwnership {
    teamId: string;
    trajectory: Trajectory;
    trajectoryContext: JobTrajectoryContext;
};

interface ResolvedAnalysisOwnership extends ResolvedTrajectoryOwnership {
    analysis: Analysis;
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

        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService)
        private readonly analysisExecutionLogService: AnalysisExecutionLogService,

        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository
    ) {}

    /**
     * Called by the PluginExecutionRouter after dispatching jobs to the daemon.
     * Initializes a Redis counter so we can track when all jobs have settled.
     */
    async initializeSession(analysisId: string, totalJobs: number, teamId: string): Promise<void> {
        const remainingKey = this.remainingKey(analysisId);
        const failedKey = this.failedKey(analysisId);
        const terminalReceiptSetKey = this.analysisTerminalReceiptSetKey(analysisId);
        const [terminalReceiptKeys, failedCountRaw] = await Promise.all([
            this.redis.smembers(terminalReceiptSetKey),
            this.redis.get(failedKey)
        ]);
        const remainingJobs = Math.max(0, totalJobs - terminalReceiptKeys.length);
        const failedJobs = Number.parseInt(failedCountRaw ?? '0', 10) || 0;

        const pipeline = this.redis.pipeline();
        if (remainingJobs > 0) {
            pipeline.set(remainingKey, remainingJobs.toString(), 'EX', SESSION_TTL_SECONDS);
        } else {
            pipeline.del(remainingKey);
        }
        pipeline.expire(failedKey, SESSION_TTL_SECONDS);
        pipeline.expire(terminalReceiptSetKey, SESSION_TTL_SECONDS);

        await pipeline.exec();

        logger.info(
            {
                analysisId,
                failedJobs,
                preSettledJobs: terminalReceiptKeys.length,
                remainingJobs,
                totalJobs
            },
            '[DaemonAnalysisCompletion] Initialized session for analysis'
        );

        if (remainingJobs === 0) {
            await this.finalizeAnalysis(analysisId, teamId, failedJobs);
        }
    }

    async clearAnalysisSession(analysisId: string): Promise<void> {
        const terminalReceiptSetKey = this.analysisTerminalReceiptSetKey(analysisId);
        const staleReceiptKeys = await this.redis.smembers(terminalReceiptSetKey);
        const pipeline = this.redis.pipeline();

        pipeline.del(this.remainingKey(analysisId));
        pipeline.del(this.failedKey(analysisId));
        pipeline.del(terminalReceiptSetKey);

        if (staleReceiptKeys.length > 0) {
            pipeline.del(...staleReceiptKeys);
        }

        await pipeline.exec();
    }

    /**
     * Called by the PluginExecutionRouter after dispatching jobs to the daemon.
     * Publishes queued job events so the jobs module can project them and the
     * team module can notify connected clients.
     */
    async handleJobsQueued(jobs: QueuedJobNotification[], teamId: string, teamClusterId: string): Promise<void> {
        for (const job of jobs) {
            const trajectoryContext: JobTrajectoryContext = {
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                timestep: job.timestep
            };

            await this.publishJobStatusChanged({
                jobId: job.jobId,
                teamId,
                teamClusterId,
                status: JobStatus.Queued,
                queueType: ANALYSIS_QUEUE_TYPE,
                cleanupScope: ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE,
                name: job.name,
                analysisId: job.analysisId,
                trajectoryContext
            });
        }

        logger.info(
            `[DaemonAnalysisCompletion] Published ${jobs.length} queued jobs for team ${teamId}`
        );
    }

    async handleQueuedJobs(
        jobs: QueuedDaemonJobNotification[],
        cleanupScope: string,
        teamClusterId: string
    ): Promise<void> {
        await Promise.all(jobs.map((job) => {
            return this.publishJobStatusChanged({
                jobId: job.jobId,
                teamId: job.teamId,
                teamClusterId,
                status: JobStatus.Queued,
                queueType: job.queueType,
                cleanupScope,
                name: job.name,
                analysisId: job.analysisId,
                trajectoryContext: {
                    trajectoryId: job.trajectoryId,
                    trajectoryName: job.trajectoryName,
                    timestep: job.timestep
                }
            });
        }));
    }

    /**
     * Called when the daemon reports a single job completed or failed.
     * Publishes status changes and handles session drain.
     */
    async handleJobCompletion(input: DaemonJobCompletionInput): Promise<void> {
        const { jobId, analysisId, success, error } = input;
        const resolved = await this.resolveAnalysisOwnership(input);
        const teamId = resolved.teamId;
        const status = success ? JobStatus.Completed : JobStatus.Failed;
        const trajectoryContext = resolved.trajectoryContext;
        const name = input.name;

        const accepted = await this.tryMarkTerminalReceipt(
            this.analysisTerminalReceiptKey(analysisId, jobId),
            this.analysisTerminalReceiptSetKey(analysisId),
            status
        );
        if (!accepted) {
            return;
        }

        // 1. Publish job status changed event
        await this.publishJobStatusChanged({
            jobId,
            teamId,
            teamClusterId: input.teamClusterId,
            status,
            queueType: ANALYSIS_QUEUE_TYPE,
            cleanupScope: ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE,
            name,
            analysisId,
            trajectoryContext,
            error
        });

        if (typeof trajectoryContext.timestep === 'number' && trajectoryContext.trajectoryId) {
            await this.analysisExecutionLogService.sealFrameLog({
                analysisId,
                teamId,
                trajectoryId: trajectoryContext.trajectoryId,
                jobId,
                timestep: trajectoryContext.timestep,
                status: success ? 'completed' : 'failed'
            }).catch((sealError: unknown) => {
                logger.warn(
                    { analysisId, jobId, err: sealError, timestep: trajectoryContext.timestep },
                    '[DaemonAnalysisCompletion] Failed to seal frame log'
                );
            });
        }

        // 2. Increment completedFrames on analysis
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

        // 3. Record failure if applicable
        if (!success) {
            await this.recordFailure(analysisId);
        }

        // 4. Atomically decrement remaining counter
        const drainResult = await this.decrementAndCheckDrain(analysisId);
        if (!drainResult.drained) {
            return;
        }

        // 5. All jobs settled - finalize analysis
        await this.finalizeAnalysis(analysisId, teamId, drainResult.failedJobs);
    }

    /**
     * Called when the daemon reports a real-time analysis job status change (e.g. running).
     * Publishes the status change so projections and socket notifications stay
     * centralized in event subscribers. Does NOT affect session drain counters.
     */
    async handleAnalysisJobStatus(input: DaemonAnalysisJobStatusInput): Promise<void> {
        const { jobId, analysisId, status, error } = input;
        const resolved = await this.resolveAnalysisOwnership(input);
        const teamId = resolved.teamId;
        const trajectoryContext = resolved.trajectoryContext;

        if (await this.hasTerminalReceipt(this.analysisTerminalReceiptKey(analysisId, jobId))) {
            return;
        }

        if (status === JobStatus.Running && typeof trajectoryContext.timestep === 'number' && trajectoryContext.trajectoryId) {
            await this.analysisExecutionLogService.markFrameRunning({
                analysisId,
                teamId,
                trajectoryId: trajectoryContext.trajectoryId,
                jobId,
                timestep: trajectoryContext.timestep
            }).catch((markError: unknown) => {
                logger.warn(
                    { analysisId, jobId, err: markError, timestep: trajectoryContext.timestep },
                    '[DaemonAnalysisCompletion] Failed to initialize frame log state'
                );
            });
        }

        await this.publishJobStatusChanged({
            jobId,
            teamId,
            teamClusterId: input.teamClusterId,
            status,
            queueType: ANALYSIS_QUEUE_TYPE,
            cleanupScope: ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE,
            name: input.name,
            analysisId,
            trajectoryContext,
            error
        });
    }

    async handleRasterJobStatus(input: DaemonRasterJobStatusInput): Promise<void> {
        const resolved = await this.resolveTrajectoryOwnership(input);
        const jobId = this.requireRasterJobId(input.jobId);
        const trajectoryContext = resolved.trajectoryContext;

        await this.publishJobStatusChanged({
            jobId,
            teamId: resolved.teamId,
            teamClusterId: input.teamClusterId,
            status: input.status,
            queueType: RASTER_QUEUE_TYPE,
            cleanupScope: RASTER_PROJECTED_JOB_CLEANUP_SCOPE,
            name: 'Rasterize trajectory preview',
            trajectoryContext,
            error: input.error
        });
    }

    /**
     * Called when the daemon reports a GLB conversion job status change.
     * Publishes the status change and handles GLB session drain.
     */
    async handleGlbJobStatus(input: DaemonGlbJobStatusInput): Promise<void> {
        const { jobId, status, error } = input;
        const resolved = await this.resolveTrajectoryOwnership(input);
        const teamId = resolved.teamId;
        const trajectoryId = resolved.trajectory.id;
        const trajectoryContext = resolved.trajectoryContext;
        const terminalReceiptKey = this.glbTerminalReceiptKey(trajectoryId, jobId);
        const isTerminal = status === JobStatus.Completed || status === JobStatus.Failed;

        if (isTerminal) {
            const accepted = await this.tryMarkTerminalReceipt(
                terminalReceiptKey,
                this.glbTerminalReceiptSetKey(trajectoryId),
                status
            );

            if (!accepted) {
                return;
            }
        } else if (await this.hasTerminalReceipt(terminalReceiptKey)) {
            return;
        }

        // 1. Publish job status changed event
        await this.publishJobStatusChanged({
            jobId,
            teamId,
            teamClusterId: input.teamClusterId,
            status,
            queueType: GLB_QUEUE_TYPE,
            cleanupScope: GLB_PROJECTED_JOB_CLEANUP_SCOPE,
            name: 'Preprocess trajectory frame',
            trajectoryContext,
            error
        });

        // 2. Only process drain logic for terminal statuses
        if (!isTerminal) {
            return;
        }

        // 3. Record failure if applicable
        if (status === JobStatus.Failed) {
            await this.recordGlbFailure(trajectoryId);
        }

        // 4. Atomically decrement remaining counter
        const drainResult = await this.decrementAndCheckGlbDrain(trajectoryId);
        if (!drainResult.drained) {
            return;
        }

        // 5. All GLB jobs settled - finalize trajectory
        await this.finalizeGlbSession(trajectoryId, teamId, drainResult.failedJobs);
    }

    async handleSshImportJobStatus(input: DaemonSshImportJobStatusInput): Promise<void> {
        const resolved = await this.resolveTrajectoryOwnership(input);

        await this.publishJobStatusChanged({
            jobId: input.jobId,
            teamId: resolved.teamId,
            teamClusterId: input.teamClusterId,
            status: input.status,
            queueType: SSH_IMPORT_QUEUE_TYPE,
            cleanupScope: SSH_IMPORT_PROJECTED_JOB_CLEANUP_SCOPE,
            name: 'Import trajectory from SSH',
            trajectoryContext: resolved.trajectoryContext,
            error: input.error
        });
    }

    async handleArtifactUploadJobStatus(input: DaemonArtifactUploadJobStatusInput): Promise<void> {
        await this.publishJobStatusChanged({
            jobId: input.jobId,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            status: input.status,
            queueType: ARTIFACT_UPLOAD_QUEUE_TYPE,
            cleanupScope: ARTIFACT_UPLOAD_PROJECTED_JOB_CLEANUP_SCOPE,
            name: 'Artifact Upload',
            analysisId: input.analysisId,
            trajectoryContext: {
                trajectoryId: input.trajectoryId,
                trajectoryName: input.trajectoryName,
                timestep: input.timestep
            },
            error: input.error
        });
    }

    private async publishJobStatusChanged(input: ProjectedJobStatusInput): Promise<void> {
        const {
            jobId,
            teamId,
            teamClusterId,
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
                teamClusterId,
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

    private async resolveAnalysisOwnership(
        input: Pick<
            DaemonJobCompletionInput,
            'teamClusterId' | 'analysisId' | 'teamId' | 'trajectoryId' | 'trajectoryName' | 'timestep'
        >
    ): Promise<ResolvedAnalysisOwnership> {
        const analysis = await this.analysisRepo.findById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND', 'Analysis not found');
        }

        if (analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                'TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH',
                'Analysis does not belong to the provided team'
            );
        }

        const analysisComputeClusterId = resolveAnalysisComputeClusterId(analysis.props);
        if (analysisComputeClusterId && analysisComputeClusterId !== input.teamClusterId) {
            throw ApplicationError.forbidden(
                'TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH',
                'Analysis compute ownership does not belong to the authenticated team cluster'
            );
        }

        const trajectory = await this.trajectoryRepo.findById(analysis.props.trajectory);
        if (!trajectory) {
            throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND', 'Trajectory not found');
        }

        if (trajectory.props.team !== analysis.props.team) {
            throw ApplicationError.conflict(
                'TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_TEAM_MISMATCH',
                'Analysis ownership does not match its trajectory'
            );
        }

        if (input.trajectoryId && input.trajectoryId !== trajectory.id) {
            throw ApplicationError.badRequest(
                'TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH',
                'Payload trajectory does not match persisted analysis ownership'
            );
        }

        if (input.trajectoryName && input.trajectoryName !== trajectory.props.name) {
            throw ApplicationError.badRequest(
                'TEAM_CLUSTER_DAEMON_TRAJECTORY_NAME_MISMATCH',
                'Payload trajectory name does not match persisted trajectory ownership'
            );
        }

        return {
            analysis,
            trajectory,
            teamId: analysis.props.team,
            trajectoryContext: {
                trajectoryId: trajectory.id,
                trajectoryName: trajectory.props.name,
                timestep: input.timestep
            }
        };
    }

    private async resolveTrajectoryOwnership(
        input: Pick<
            DaemonRasterJobStatusInput,
            'teamClusterId' | 'trajectoryId' | 'teamId' | 'trajectoryName' | 'timestep'
        >
    ): Promise<ResolvedTrajectoryOwnership> {
        const trajectory = await this.trajectoryRepo.findById(input.trajectoryId);
        if (!trajectory) {
            throw ApplicationError.notFound('TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND', 'Trajectory not found');
        }

        if (trajectory.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                'TEAM_CLUSTER_DAEMON_TRAJECTORY_TEAM_MISMATCH',
                'Trajectory does not belong to the provided team'
            );
        }

        if (input.trajectoryName && input.trajectoryName !== trajectory.props.name) {
            throw ApplicationError.badRequest(
                'TEAM_CLUSTER_DAEMON_TRAJECTORY_NAME_MISMATCH',
                'Payload trajectory name does not match persisted trajectory ownership'
            );
        }

        return {
            teamId: trajectory.props.team,
            trajectory,
            trajectoryContext: {
                trajectoryId: trajectory.id,
                trajectoryName: trajectory.props.name,
                timestep: input.timestep
            }
        };
    }

    private async tryMarkTerminalReceipt(
        receiptKey: string,
        receiptSetKey: string | undefined,
        status: JobStatus
    ): Promise<boolean> {
        const result = await this.redis.set(receiptKey, status, 'EX', SESSION_TTL_SECONDS, 'NX');
        if (result === 'OK' && receiptSetKey) {
            const pipeline = this.redis.pipeline();
            pipeline.sadd(receiptSetKey, receiptKey);
            pipeline.expire(receiptSetKey, SESSION_TTL_SECONDS);
            await pipeline.exec();
        }

        return result === 'OK';
    }

    private async hasTerminalReceipt(receiptKey: string): Promise<boolean> {
        return (await this.redis.exists(receiptKey)) === 1;
    }

    private async recordFailure(analysisId: string): Promise<void> {
        const failedKey = this.failedKey(analysisId);
        await this.redis.incr(failedKey);
        await this.redis.expire(failedKey, SESSION_TTL_SECONDS);
    }

    private async decrementAndCheckDrain(analysisId: string): Promise<{ drained: boolean; failedJobs: number }> {
        const luaScript = `
            local ttl = tonumber(ARGV[1])
            if redis.call('EXISTS', KEYS[1]) == 0 then
                return {0, 0}
            end
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
            if redis.call('EXISTS', KEYS[1]) == 0 then
                return {0, 0}
            end
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

    private glbTerminalReceiptKey(trajectoryId: string, jobId: string): string {
        return `daemon-glb:${trajectoryId}:terminal:${jobId}`;
    }

    private glbTerminalReceiptSetKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:terminal-keys`;
    }

    private glbFailedKey(trajectoryId: string): string {
        return `daemon-glb:${trajectoryId}:failed`;
    }

    private remainingKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:remaining`;
    }

    private analysisTerminalReceiptKey(analysisId: string, jobId: string): string {
        return `daemon-analysis:${analysisId}:terminal:${jobId}`;
    }

    private analysisTerminalReceiptSetKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:terminal-keys`;
    }

    private failedKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:failed`;
    }

};
