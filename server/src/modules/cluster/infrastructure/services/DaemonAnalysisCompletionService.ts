import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type {
    AnalysisArtifactStatus,
    AnalysisChildAnalysis,
    AnalysisExpectedArtifact,
    AnalysisStage,
    AnalysisStageStatus,
    AnalysisStageType
} from '@modules/analysis/domain/entities/Analysis';
import AnalysisStageChangedEvent from '@modules/analysis/domain/events/AnalysisStageChangedEvent';
import AnalysisStatusChangedEvent from '@modules/analysis/domain/events/AnalysisStatusChangedEvent';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import JobStatusChangedEvent from '@modules/jobs/domain/events/JobStatusChangedEvent';
import { resolveAnalysisComputeClusterId } from '@modules/cluster/application/utilities/cluster-location';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import IORedis from 'ioredis';
import { inject } from 'tsyringe';

const ANALYSIS_QUEUE_TYPE = 'analysis_processing';
const RASTER_QUEUE_TYPE = 'trajectory_rasterization';
const GLB_QUEUE_TYPE = 'trajectory_glb_conversion';
const ARTIFACT_UPLOAD_QUEUE_TYPE = 'artifact_upload';
const SESSION_TTL_SECONDS = 86400;
const JOB_STATUS_PUBLISH_BATCH_SIZE = 50;

const swallow = (message: string, context: Record<string, unknown>) =>
    (err: unknown) => logger.warn({ ...context, err }, `[DaemonAnalysisCompletion] ${message}`);

// Returns [drained (0|1), failedJobs]; idempotent: if remainingKey is already gone, returns [0, 0].
const DECREMENT_DRAIN_SCRIPT = `
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

// Returns [remainingJobs, failedJobs]; late-arriving receipts may already have drained the session.
const INITIALIZE_SESSION_SCRIPT = `
local remainingKey = KEYS[1]
local failedKey = KEYS[2]
local terminalReceiptSetKey = KEYS[3]
local totalJobs = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])

local terminalCount = redis.call('SCARD', terminalReceiptSetKey)
local failedCount = tonumber(redis.call('GET', failedKey) or '0')
local remaining = totalJobs - terminalCount
if remaining < 0 then remaining = 0 end

if remaining > 0 then
    redis.call('SET', remainingKey, tostring(remaining), 'EX', ttlSeconds)
else
    redis.call('DEL', remainingKey)
end

if redis.call('EXISTS', failedKey) == 1 then
    redis.call('EXPIRE', failedKey, ttlSeconds)
end
if redis.call('EXISTS', terminalReceiptSetKey) == 1 then
    redis.call('EXPIRE', terminalReceiptSetKey, ttlSeconds)
end

return { remaining, failedCount }
`;
const PROJECTED_JOB_SOURCE = 'projected';
const PROJECTED_JOB_BACKING_SOURCE = 'daemon';
const ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE = 'analysis';
const RASTER_PROJECTED_JOB_CLEANUP_SCOPE = 'raster';
const GLB_PROJECTED_JOB_CLEANUP_SCOPE = 'glb';
const ARTIFACT_UPLOAD_PROJECTED_JOB_CLEANUP_SCOPE = 'artifact-upload';

interface JobTrajectoryContext {
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
}

interface DaemonJobInputBase {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    error?: string;
}

interface DaemonJobCompletionInput extends DaemonJobInputBase {
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    success: boolean;
}

interface DaemonRasterJobStatusInput extends DaemonJobInputBase {
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
}

interface DaemonGlbJobStatusInput extends DaemonJobInputBase {
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
}

interface DaemonAnalysisJobStatusInput extends DaemonJobInputBase {
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    status: JobStatus;
}

interface DaemonArtifactUploadJobStatusInput extends DaemonJobInputBase {
    analysisId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
}

interface QueuedJobNotification {
    jobId: string;
    name: string;
    teamId: string;
    timestep: number;
    trajectoryId: string;
    trajectoryName?: string;
    analysisId: string;
    queueType: string;
}

interface QueuedDaemonJobNotification {
    jobId: string;
    teamId: string;
    queueType: string;
    name?: string;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
}

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
}

interface DaemonAnalysisStageStatusInput extends DaemonJobInputBase {
    name: string;
    analysisId: string;
    trajectoryId?: string;
    timestep?: number;
    stageKey: string;
    label: string;
    stageType: AnalysisStageType;
    stageStatus: AnalysisStageStatus;
    pluginId?: string;
    pluginDisplayName?: string;
    nodeId?: string;
    exposureId?: string;
    configHash?: string;
    cacheHit?: boolean;
    detail?: string;
    startedAt?: string;
    finishedAt?: string;
    durationMs?: number;
}

interface ResolvedTrajectoryOwnership {
    teamId: string;
    trajectory: Trajectory;
    trajectoryContext: JobTrajectoryContext;
}

interface ResolvedAnalysisOwnership extends ResolvedTrajectoryOwnership {
    analysis: Analysis;
}

@Singleton()
export default class DaemonAnalysisCompletionService {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        private readonly analysisRepo: AnalysisRepository,
        private readonly analysisExecutionLogService: AnalysisExecutionLogService,
        private readonly trajectoryRepo: TrajectoryRepository
    ) {}

    /**
     * Called by the PluginExecutionRouter after dispatching jobs to the daemon.
     * Initializes a Redis counter so we can track when all jobs have settled.
     */
    async initializeSession(analysisId: string, totalJobs: number, teamId: string, trajectoryId?: string): Promise<void> {
        const keys = this.analysisKeys(analysisId);

        const [scriptResult] = await Promise.all([
            this.redis.eval(
                INITIALIZE_SESSION_SCRIPT,
                3,
                keys.remaining,
                keys.failed,
                keys.terminalSet,
                totalJobs.toString(),
                SESSION_TTL_SECONDS.toString()
            ) as Promise<[number, number]>,
            this.analysisRepo.updateById(analysisId, {
                status: 'running',
                totalFrames: totalJobs,
                startedAt: new Date()
            }).catch(swallow('Failed to mark analysis as running', { analysisId }))
        ]);

        const [remainingJobs, failedJobs] = scriptResult;

        await this.publishAnalysisStatus(analysisId, teamId, 'running', {
            trajectoryId,
            totalFrames: totalJobs,
            completedFrames: 0,
            failedFrames: failedJobs
        });

        if (remainingJobs === 0) {
            await this.finalizeAnalysis(analysisId, teamId, failedJobs);
        }
    }

    /**
     * Called by trajectory ingestion after the daemon has accepted frame
     * processing jobs. Terminal receipts may arrive before this initializer
     * runs, so use the same late-receipt-aware script as analysis sessions.
     */
    async initializeGlbSession(trajectoryId: string, totalJobs: number, teamId: string): Promise<void> {
        const keys = this.glbKeys(trajectoryId);
        const [remainingJobs, failedJobs] = await this.redis.eval(
            INITIALIZE_SESSION_SCRIPT,
            3,
            keys.remaining,
            keys.failed,
            keys.terminalSet,
            totalJobs.toString(),
            SESSION_TTL_SECONDS.toString()
        ) as [number, number];

        if (remainingJobs === 0) {
            await this.finalizeGlbSession(trajectoryId, teamId, failedJobs);
        }
    }

    /**
     * Called by the PluginExecutionRouter after dispatching jobs to the daemon.
     * Publishes queued job events so the jobs module can project them and the
     * team module can notify connected clients.
     */
    async handleJobsQueued(jobs: QueuedJobNotification[], teamId: string, teamClusterId: string): Promise<void> {
        const events = jobs.map((job): ProjectedJobStatusInput => {
            const trajectoryContext: JobTrajectoryContext = {
                trajectoryId: job.trajectoryId,
                trajectoryName: job.trajectoryName,
                timestep: job.timestep
            };

            return {
                jobId: job.jobId,
                teamId,
                teamClusterId,
                status: JobStatus.Queued,
                queueType: ANALYSIS_QUEUE_TYPE,
                cleanupScope: ANALYSIS_PROJECTED_JOB_CLEANUP_SCOPE,
                name: job.name,
                analysisId: job.analysisId,
                trajectoryContext
            };
        });

        await this.publishJobStatusChangedBatch(events);
    }

    async handleQueuedJobs(
        jobs: QueuedDaemonJobNotification[],
        cleanupScope: string,
        teamClusterId: string
    ): Promise<void> {
        const events = jobs.map((job): ProjectedJobStatusInput => {
            return {
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
            };
        });

        await this.publishJobStatusChangedBatch(events);
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

        const keys = this.analysisKeys(analysisId);
        const accepted = await this.tryMarkTerminalReceipt(
            keys.terminal(jobId),
            keys.terminalSet,
            status
        );
        if (!accepted) {
            return;
        }

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
            }).catch(swallow('Failed to seal frame log', { analysisId, jobId, timestep: trajectoryContext.timestep }));
        }

        if (success) {
            const completedFramesUpdate: Record<string, unknown> = {
                $inc: { completedFrames: 1 }
            };

            await this.analysisRepo.updateById(analysisId, completedFramesUpdate)
                .catch(swallow('Failed to increment completedFrames', { analysisId }));
        } else {
            await this.recordFailure(keys.failed);
        }

        const drainResult = await this.decrementAndCheckDrain(keys.remaining, keys.failed);
        if (!drainResult.drained) {
            return;
        }

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

        if (await this.hasTerminalReceipt(this.analysisKeys(analysisId).terminal(jobId))) {
            return;
        }

        if (status === JobStatus.Running && typeof trajectoryContext.timestep === 'number' && trajectoryContext.trajectoryId) {
            await this.analysisExecutionLogService.markFrameRunning({
                analysisId,
                teamId,
                trajectoryId: trajectoryContext.trajectoryId,
                jobId,
                timestep: trajectoryContext.timestep
            }).catch(swallow('Failed to initialize frame log state', { analysisId, jobId, timestep: trajectoryContext.timestep }));
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

    async handleAnalysisStageStatus(input: DaemonAnalysisStageStatusInput): Promise<void> {
        const resolved = await this.resolveAnalysisOwnership(input);
        const analysis = resolved.analysis;
        const trajectoryId = resolved.trajectory.id;
        const stage = this.toAnalysisStage(input, resolved.trajectoryContext.timestep);
        const currentStages = analysis.props.stages ?? [];
        const previousStage = currentStages.find((candidate) => this.isSameStageIdentity(candidate, stage));
        if (previousStage && this.shouldIgnoreStageUpdate(previousStage, stage)) {
            return;
        }

        const stages = this.upsertStage(currentStages, stage);
        const expectedArtifacts = this.updateExpectedArtifactsForStage(
            analysis.props.expectedArtifacts ?? [],
            stage
        );
        const childAnalyses = this.upsertChildAnalysisForStage(
            analysis.props.childAnalyses ?? [],
            stage
        );
        const artifactStatus = this.resolveArtifactStatusForStage(
            analysis.props.artifactStatus ?? 'pending',
            expectedArtifacts,
            stage
        );

        const updatedAnalysis = await this.analysisRepo.updateById(analysis._id, {
            artifactStatus,
            expectedArtifacts,
            stages,
            childAnalyses
        }) ?? analysis;

        await this.publishAnalysisStageChanged(updatedAnalysis, resolved.teamId, trajectoryId)
            .catch(swallow('Failed to publish analysis.stage.changed', {
                analysisId: analysis._id,
                stageKey: stage.stageKey,
                timestep: stage.timestep
            }));
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

        // Why: persist `hasPreview` so the dashboard listing can render
        // thumbnail availability without paying a MinIO `listObjects` round-trip
        // per row. The first successful rasterize per trajectory flips this on;
        // it stays on until the trajectory is deleted (the document goes with
        // it). Subsequent runs are no-ops on the value but the write is cheap.
        if (input.status === JobStatus.Completed && resolved.trajectory.props.hasPreview !== true) {
            try {
                await this.trajectoryRepo.updateById(resolved.trajectory.id, { hasPreview: true });
                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId: resolved.trajectory.id,
                    teamId: resolved.teamId,
                    updates: { hasPreview: true },
                    updatedAt: new Date()
                }));
            } catch (error: unknown) {
                logger.warn({ err: error, trajectoryId: resolved.trajectory.id }, '[DaemonAnalysisCompletion] failed to persist hasPreview after raster completion');
            }
        }
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
        const keys = this.glbKeys(trajectoryId);
        const terminalReceiptKey = keys.terminal(jobId);
        const isTerminal = status === JobStatus.Completed || status === JobStatus.Failed;

        if (isTerminal) {
            const accepted = await this.tryMarkTerminalReceipt(
                terminalReceiptKey,
                keys.terminalSet,
                status
            );

            if (!accepted) {
                return;
            }
        } else if (await this.hasTerminalReceipt(terminalReceiptKey)) {
            return;
        }

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

        if (!isTerminal) {
            return;
        }

        if (status === JobStatus.Failed) {
            await this.recordFailure(keys.failed);
        }

        const drainResult = await this.decrementAndCheckDrain(keys.remaining, keys.failed);
        if (!drainResult.drained) {
            return;
        }

        await this.finalizeGlbSession(trajectoryId, teamId, drainResult.failedJobs);
    }

    async handleArtifactUploadJobStatus(input: DaemonArtifactUploadJobStatusInput): Promise<void> {
        const resolved = await this.resolveAnalysisOwnership(input);
        const nextArtifactStatus = this.resolveArtifactStatusForUpload(
            resolved.analysis.props.expectedArtifacts ?? [],
            input.status
        );

        const updatedAnalysis = await this.analysisRepo.updateById(input.analysisId, {
            artifactStatus: nextArtifactStatus
        }).catch(swallow('Failed to update artifactStatus from upload job', {
            analysisId: input.analysisId,
            jobId: input.jobId,
            status: input.status
        }));

        if (updatedAnalysis) {
            await this.publishAnalysisStageChanged(updatedAnalysis, resolved.teamId, resolved.trajectory.id)
                .catch(swallow('Failed to publish analysis.stage.changed after upload status', {
                    analysisId: input.analysisId,
                    jobId: input.jobId
                }));
        }

        await this.publishJobStatusChanged({
            jobId: input.jobId,
            teamId: resolved.teamId,
            teamClusterId: input.teamClusterId,
            status: input.status,
            queueType: ARTIFACT_UPLOAD_QUEUE_TYPE,
            cleanupScope: ARTIFACT_UPLOAD_PROJECTED_JOB_CLEANUP_SCOPE,
            name: 'Artifact Upload',
            analysisId: input.analysisId,
            trajectoryContext: resolved.trajectoryContext,
            error: input.error
        });
    }

    private async publishAnalysisStatus(
        analysisId: string,
        teamId: string,
        status: Analysis['props']['status'],
        extras: {
            trajectoryId?: string;
            totalFrames?: number;
            completedFrames?: number;
            failedFrames?: number;
            artifactStatus?: AnalysisArtifactStatus;
            expectedArtifacts?: AnalysisExpectedArtifact[];
            stages?: AnalysisStage[];
            childAnalyses?: AnalysisChildAnalysis[];
        } = {}
    ): Promise<void> {
        await this.eventBus.publish(new AnalysisStatusChangedEvent({
            analysisId,
            trajectoryId: extras.trajectoryId ?? '',
            teamId,
            status,
            totalFrames: extras.totalFrames,
            completedFrames: extras.completedFrames,
            failedFrames: extras.failedFrames,
            artifactStatus: extras.artifactStatus,
            expectedArtifacts: extras.expectedArtifacts,
            stages: extras.stages,
            childAnalyses: extras.childAnalyses
        })).catch(swallow('Failed to publish analysis.status.changed', { analysisId, status }));
    }

    private async publishAnalysisStageChanged(
        analysis: Analysis,
        teamId: string,
        trajectoryId: string
    ): Promise<void> {
        await this.eventBus.publish(new AnalysisStageChangedEvent({
            analysisId: analysis._id,
            trajectoryId,
            teamId,
            artifactStatus: analysis.props.artifactStatus,
            expectedArtifacts: analysis.props.expectedArtifacts,
            stages: analysis.props.stages,
            childAnalyses: analysis.props.childAnalyses
        }));
    }

    private toAnalysisStage(input: DaemonAnalysisStageStatusInput, timestep?: number): AnalysisStage {
        return {
            stageKey: input.stageKey,
            label: input.label,
            type: input.stageType,
            status: input.stageStatus,
            timestep,
            pluginId: input.pluginId,
            pluginDisplayName: input.pluginDisplayName,
            nodeId: input.nodeId,
            exposureId: input.exposureId,
            configHash: input.configHash,
            cacheHit: input.cacheHit,
            detail: input.detail,
            startedAt: this.parseDate(input.startedAt),
            finishedAt: this.parseDate(input.finishedAt),
            durationMs: input.durationMs
        };
    }

    private upsertStage(stages: AnalysisStage[], stage: AnalysisStage): AnalysisStage[] {
        const index = stages.findIndex((candidate) => this.isSameStageIdentity(candidate, stage));
        if (index < 0) {
            return [...stages, stage];
        }

        const previous = stages[index];
        if (previous && this.shouldIgnoreStageUpdate(previous, stage)) {
            return stages;
        }

        const next = [...stages];
        next[index] = {
            ...previous,
            ...stage,
            startedAt: stage.startedAt ?? previous.startedAt,
            finishedAt: stage.finishedAt ?? previous.finishedAt,
            durationMs: stage.durationMs ?? previous.durationMs
        };
        return next;
    }

    private isSameStageIdentity(left: AnalysisStage, right: AnalysisStage): boolean {
        return left.stageKey === right.stageKey
            && this.hasSameTimestepIdentity(left.timestep, right.timestep);
    }

    private hasSameTimestepIdentity(left?: number, right?: number): boolean {
        const hasLeftTimestep = typeof left === 'number';
        const hasRightTimestep = typeof right === 'number';

        if (hasLeftTimestep || hasRightTimestep) {
            return left === right;
        }

        return true;
    }

    private shouldIgnoreStageUpdate(previous: AnalysisStage, next: AnalysisStage): boolean {
        if (!this.isTerminalStageStatus(previous.status) || this.isTerminalStageStatus(next.status)) {
            return false;
        }

        const previousFinishedAt = previous.finishedAt?.getTime();
        const nextStartedAt = next.startedAt?.getTime();
        return typeof previousFinishedAt === 'number'
            && typeof nextStartedAt === 'number'
            && nextStartedAt <= previousFinishedAt;
    }

    private isTerminalStageStatus(status: AnalysisStageStatus): boolean {
        return status === 'completed' || status === 'failed' || status === 'cached';
    }

    private updateExpectedArtifactsForStage(
        artifacts: AnalysisExpectedArtifact[],
        stage: AnalysisStage
    ): AnalysisExpectedArtifact[] {
        if (stage.type !== 'exposure' || !stage.exposureId) {
            return artifacts;
        }

        const nextStatus = stage.status === 'failed'
            ? 'failed'
            : stage.status === 'running'
                ? 'generating'
                : stage.status === 'completed' || stage.status === 'cached'
                    ? 'uploading'
                    : undefined;

        if (!nextStatus) {
            return artifacts;
        }

        return artifacts.map((artifact) => artifact.exposureId === stage.exposureId
            ? {
                ...artifact,
                status: artifact.status === 'ready' && nextStatus !== 'failed'
                    ? artifact.status
                    : nextStatus
            }
            : artifact);
    }

    private upsertChildAnalysisForStage(
        childAnalyses: AnalysisChildAnalysis[],
        stage: AnalysisStage
    ): AnalysisChildAnalysis[] {
        if (stage.type !== 'plugin-ref' || !stage.pluginId) {
            return childAnalyses;
        }

        const child: AnalysisChildAnalysis = {
            id: stage.stageKey,
            pluginId: stage.pluginId,
            pluginDisplayName: stage.pluginDisplayName,
            configHash: stage.configHash,
            timestep: stage.timestep,
            status: stage.status,
            cacheHit: stage.cacheHit,
            startedAt: stage.startedAt,
            finishedAt: stage.finishedAt,
            durationMs: stage.durationMs
        };
        const index = childAnalyses.findIndex((candidate) => this.isSameChildAnalysisIdentity(candidate, child));
        if (index < 0) {
            return [...childAnalyses, child];
        }

        const next = [...childAnalyses];
        if (this.shouldIgnoreChildAnalysisUpdate(next[index]!, child)) {
            return childAnalyses;
        }

        next[index] = {
            ...next[index],
            ...child,
            startedAt: child.startedAt ?? next[index].startedAt,
            finishedAt: child.finishedAt ?? next[index].finishedAt,
            durationMs: child.durationMs ?? next[index].durationMs
        };
        return next;
    }

    private isSameChildAnalysisIdentity(left: AnalysisChildAnalysis, right: AnalysisChildAnalysis): boolean {
        return left.id === right.id
            && this.hasSameTimestepIdentity(left.timestep, right.timestep);
    }

    private shouldIgnoreChildAnalysisUpdate(previous: AnalysisChildAnalysis, next: AnalysisChildAnalysis): boolean {
        if (!this.isTerminalStageStatus(previous.status) || this.isTerminalStageStatus(next.status)) {
            return false;
        }

        const previousFinishedAt = previous.finishedAt?.getTime();
        const nextStartedAt = next.startedAt?.getTime();
        return typeof previousFinishedAt === 'number'
            && typeof nextStartedAt === 'number'
            && nextStartedAt <= previousFinishedAt;
    }

    private resolveArtifactStatusForStage(
        currentStatus: AnalysisArtifactStatus,
        expectedArtifacts: AnalysisExpectedArtifact[],
        stage: AnalysisStage
    ): AnalysisArtifactStatus {
        if (stage.status === 'failed') {
            return 'failed';
        }
        if (currentStatus === 'ready') {
            return currentStatus;
        }
        if (stage.type === 'exposure' && stage.status === 'running') {
            return 'generating';
        }
        if (stage.type === 'exposure' && (stage.status === 'completed' || stage.status === 'cached')) {
            return this.areArtifactsReady(expectedArtifacts) ? 'ready' : 'uploading';
        }
        if (stage.type === 'artifact-upload' && stage.status === 'running') {
            return 'uploading';
        }
        if (stage.type === 'artifact-upload' && stage.status === 'completed') {
            return this.areArtifactsReady(expectedArtifacts) ? 'ready' : 'uploading';
        }
        return currentStatus;
    }

    private resolveArtifactStatusForUpload(
        expectedArtifacts: AnalysisExpectedArtifact[],
        status: JobStatus
    ): AnalysisArtifactStatus {
        if (status === JobStatus.Failed) {
            return 'failed';
        }
        if (status === JobStatus.Queued || status === JobStatus.Running || status === JobStatus.Completed) {
            return this.areArtifactsReady(expectedArtifacts) ? 'ready' : 'uploading';
        }
        return 'pending';
    }

    private areArtifactsReady(expectedArtifacts: AnalysisExpectedArtifact[]): boolean {
        return expectedArtifacts.length > 0
            && expectedArtifacts.every((artifact) => artifact.status === 'ready');
    }

    private parseDate(value: string | undefined): Date | undefined {
        if (!value) {
            return undefined;
        }

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    private closeRunningStages(
        stages: AnalysisStage[] | undefined,
        finalStatus: Analysis['props']['status'],
        finishedAt: Date
    ): AnalysisStage[] | undefined {
        if (!stages?.length) {
            return stages;
        }

        const stageStatus: AnalysisStageStatus = finalStatus === 'failed' ? 'failed' : 'completed';
        return stages.map((stage) => {
            if (stage.status !== 'running') {
                return stage;
            }

            return {
                ...stage,
                status: stageStatus,
                finishedAt,
                durationMs: stage.durationMs
                    ?? (stage.startedAt ? Math.max(0, finishedAt.getTime() - stage.startedAt.getTime()) : undefined)
            };
        });
    }

    private closeRunningChildAnalyses(
        childAnalyses: AnalysisChildAnalysis[] | undefined,
        finalStatus: Analysis['props']['status'],
        finishedAt: Date
    ): AnalysisChildAnalysis[] | undefined {
        if (!childAnalyses?.length) {
            return childAnalyses;
        }

        const stageStatus: AnalysisStageStatus = finalStatus === 'failed' ? 'failed' : 'completed';
        return childAnalyses.map((child) => {
            if (child.status !== 'running') {
                return child;
            }

            return {
                ...child,
                status: stageStatus,
                finishedAt,
                durationMs: child.durationMs
                    ?? (child.startedAt ? Math.max(0, finishedAt.getTime() - child.startedAt.getTime()) : undefined)
            };
        });
    }

    private closeGeneratingArtifacts(
        expectedArtifacts: AnalysisExpectedArtifact[] | undefined,
        finalStatus: Analysis['props']['status']
    ): AnalysisExpectedArtifact[] | undefined {
        if (!expectedArtifacts?.length) {
            return expectedArtifacts;
        }

        let changed = false;
        const nextArtifacts = expectedArtifacts.map((artifact) => {
            if (artifact.status !== 'generating') {
                return artifact;
            }

            changed = true;
            const nextStatus: AnalysisExpectedArtifact['status'] = finalStatus === 'failed' ? 'failed' : 'uploading';
            return {
                ...artifact,
                status: nextStatus
            };
        });

        return changed ? nextArtifacts : expectedArtifacts;
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
            name,
            analysisId,
            teamClusterId,
            source: PROJECTED_JOB_SOURCE,
            backingSource: PROJECTED_JOB_BACKING_SOURCE,
            cleanupScope,
            trajectoryId: trajectoryContext.trajectoryId,
            trajectoryName: trajectoryContext.trajectoryName,
            timestep: trajectoryContext.timestep,
            error
        });

        await this.eventBus.publish(event);
    }

    private async publishJobStatusChangedBatch(events: ProjectedJobStatusInput[]): Promise<void> {
        for (let index = 0; index < events.length; index += JOB_STATUS_PUBLISH_BATCH_SIZE) {
            const chunk = events.slice(index, index + JOB_STATUS_PUBLISH_BATCH_SIZE);
            await Promise.all(chunk.map((event) => this.publishJobStatusChanged(event)));
        }
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
            'teamClusterId' | 'analysisId' | 'teamId' | 'trajectoryId' | 'timestep'
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
            'teamClusterId' | 'trajectoryId' | 'teamId' | 'timestep'
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

    private async recordFailure(failedKey: string): Promise<void> {
        await this.redis.incr(failedKey);
        await this.redis.expire(failedKey, SESSION_TTL_SECONDS);
    }

    private async decrementAndCheckDrain(remainingKey: string, failedKey: string): Promise<{ drained: boolean; failedJobs: number }> {
        const result = await this.redis.eval(
            DECREMENT_DRAIN_SCRIPT,
            2,
            remainingKey,
            failedKey,
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

    private async setTrajectoryStatus(trajectoryId: string, teamId: string, status: TrajectoryStatus): Promise<void> {
        await this.trajectoryRepo.updateById(trajectoryId, { status });
        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: { status },
            updatedAt: new Date()
        }));
    }

    private async finalizeAnalysis(analysisId: string, teamId: string, failedJobs: number): Promise<void> {
        const hasFailures = failedJobs > 0;
        const status: Analysis['props']['status'] = hasFailures ? 'failed' : 'completed';

        if (hasFailures) {
            logger.error(`[DaemonAnalysisCompletion] Analysis ${analysisId} completed with ${failedJobs} failed jobs`);
        } else {
            logger.info(`[DaemonAnalysisCompletion] Analysis ${analysisId} completed successfully (daemon precomputed listings)`);
        }

        const finishedAt = new Date();
        const currentAnalysis = await this.analysisRepo.findById(analysisId);
        const closedStages = this.closeRunningStages(currentAnalysis?.props.stages, status, finishedAt);
        const closedChildAnalyses = this.closeRunningChildAnalyses(currentAnalysis?.props.childAnalyses, status, finishedAt);
        const closedExpectedArtifacts = this.closeGeneratingArtifacts(currentAnalysis?.props.expectedArtifacts, status);
        const analysisUpdates: Partial<Analysis['props']> = {
            status,
            finishedAt,
            stages: closedStages,
            childAnalyses: closedChildAnalyses
        };

        if (closedExpectedArtifacts !== currentAnalysis?.props.expectedArtifacts) {
            analysisUpdates.expectedArtifacts = closedExpectedArtifacts;
        }

        const analysis = (await this.analysisRepo.updateById(analysisId, analysisUpdates)
            .catch(swallow('Failed to finalize analysis status', { analysisId, status }))) ?? currentAnalysis;

        await this.publishAnalysisStatus(analysisId, teamId, status, {
            trajectoryId: analysis?.props.trajectory,
            totalFrames: analysis?.props.totalFrames,
            completedFrames: analysis?.props.completedFrames,
            failedFrames: failedJobs,
            artifactStatus: analysis?.props.artifactStatus,
            expectedArtifacts: analysis?.props.expectedArtifacts,
            stages: analysis?.props.stages,
            childAnalyses: analysis?.props.childAnalyses
        });
    }

    private async finalizeGlbSession(trajectoryId: string, teamId: string, failedJobs: number): Promise<void> {
        const hasFailures = failedJobs > 0;
        if (hasFailures) {
            logger.error(`[DaemonAnalysisCompletion] GLB session for trajectory ${trajectoryId} completed with ${failedJobs} failed jobs`);
        }
        await this.setTrajectoryStatus(trajectoryId, teamId, hasFailures ? TrajectoryStatus.Failed : TrajectoryStatus.Completed);
    }

    private sessionKeys(namespace: string, id: string) {
        const base = `${namespace}:${id}`;
        return {
            remaining: `${base}:remaining`,
            failed: `${base}:failed`,
            terminalSet: `${base}:terminal-keys`,
            terminal: (jobId: string) => `${base}:terminal:${jobId}`
        };
    }

    private analysisKeys(analysisId: string) {
        return this.sessionKeys('daemon-analysis', analysisId);
    }

    private glbKeys(trajectoryId: string) {
        return this.sessionKeys('daemon-glb', trajectoryId);
    }

}
