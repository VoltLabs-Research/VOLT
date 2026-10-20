import eventBus from '@shared/events/PostgresEventBus';
import type { Analysis } from '@shared/contracts/types/AnalysisProps';
import { JobStatus } from '@volt/contracts/modules/jobs/domain';
import { TrajectoryStatus } from '@shared/contracts/types/Trajectory';
import type {
    DaemonAnalysisJobStatusInput,
    DaemonAnalysisStageStatusInput,
    DaemonArtifactUploadJobStatusInput,
    DaemonGlbJobStatusInput,
    DaemonJobCompletionInput,
    DaemonRasterJobStatusInput,
    QueuedDaemonJobNotification,
    QueuedJobNotification
} from '@modules/cluster/contracts/daemon-job-completion';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import logger from '@shared/logger';
import analysisStageProjection from '@modules/cluster/services/daemon/AnalysisStageProjection';
import daemonAnalysisSessionStore from '@modules/cluster/services/daemon/DaemonAnalysisSessionStore';
import daemonJobOwnershipResolver from '@modules/cluster/services/daemon/DaemonJobOwnershipResolver';
import daemonJobStatusPublisher, {
    PROJECTED_JOB_KINDS,
    swallow
} from '@modules/cluster/services/daemon/DaemonJobStatusPublisher';
import type { ProjectedJobStatusInput } from '@modules/cluster/services/daemon/DaemonJobStatusPublisher';

type QueuedJobProjection = Omit<ProjectedJobStatusInput, 'teamId' | 'queueType' | 'cleanupScope'>;

const toQueuedJobProjection = (job: QueuedDaemonJobNotification, teamClusterId: string): QueuedJobProjection => ({
    jobId: job.jobId,
    teamClusterId,
    status: JobStatus.Queued,
    name: job.name,
    analysisId: job.analysisId,
    trajectoryContext: {
        trajectoryId: job.trajectoryId,
        trajectoryName: job.trajectoryName,
        timestep: job.timestep
    }
});

class DaemonAnalysisCompletionService {
    private readonly publisher = daemonJobStatusPublisher;
    async initializeSession(analysisId: string, totalJobs: number, teamId: string, trajectoryId?: string): Promise<void> {
        const keys = daemonAnalysisSessionStore.analysisKeys(analysisId);

        const [session] = await Promise.all([
            daemonAnalysisSessionStore.initialize(keys, totalJobs),
            daemonJobOwnershipResolver.updateAnalysisById(analysisId, {
                status: 'running',
                totalFrames: totalJobs,
                startedAt: new Date()
            }).catch(swallow('Failed to mark analysis as running', { analysisId }))
        ]);

        await this.publisher.publishAnalysisStatus({
            analysisId,
            teamId,
            status: 'running',
            trajectoryId,
            totalFrames: totalJobs,
            failedFrames: session.failedJobs
        });

        if (session.remainingJobs === 0) {
            await this.finalizeAnalysis(analysisId, teamId, session.failedJobs);
        }
    }

    async initializeGlbSession(trajectoryId: string, totalJobs: number, teamId: string): Promise<void> {
        const session = await daemonAnalysisSessionStore.initialize(daemonAnalysisSessionStore.glbKeys(trajectoryId), totalJobs);
        if (session.remainingJobs === 0) {
            await this.finalizeGlbSession(trajectoryId, teamId, session.failedJobs);
        }
    }

    async handleJobsQueued(jobs: QueuedJobNotification[], teamId: string, teamClusterId: string): Promise<void> {
        const events = jobs.map((job): ProjectedJobStatusInput => ({
            ...toQueuedJobProjection(job, teamClusterId),
            teamId,
            ...PROJECTED_JOB_KINDS.analysis
        }));

        await this.publisher.publishJobStatusChangedBatch(events);
    }

    async handleQueuedJobs(
        jobs: QueuedDaemonJobNotification[],
        cleanupScope: string,
        teamClusterId: string
    ): Promise<void> {
        const events = jobs.map((job): ProjectedJobStatusInput => ({
            ...toQueuedJobProjection(job, teamClusterId),
            teamId: job.teamId,
            queueType: job.queueType,
            cleanupScope
        }));

        await this.publisher.publishJobStatusChangedBatch(events);
    }

    async handleJobCompletion(input: DaemonJobCompletionInput): Promise<void> {
        const { jobId, analysisId, success, error } = input;
        const resolved = await daemonJobOwnershipResolver.resolveAnalysisOwnership(input);
        const teamId = resolved.teamId;
        const status = success ? JobStatus.Completed : JobStatus.Failed;
        const trajectoryContext = resolved.trajectoryContext;

        const keys = daemonAnalysisSessionStore.analysisKeys(analysisId);
        const accepted = await daemonAnalysisSessionStore.tryMarkTerminalReceipt(keys, jobId, status);
        if (!accepted) {
            return;
        }

        await this.publisher.publishJobStatusChanged({
            jobId,
            teamId,
            teamClusterId: input.teamClusterId,
            status,
            ...PROJECTED_JOB_KINDS.analysis,
            name: input.name,
            analysisId,
            trajectoryContext,
            error
        });

        if (trajectoryContext.timestep !== undefined && trajectoryContext.trajectoryId) {
            await analysisExecutionLogService.sealFrameLog({
                analysisId,
                teamId,
                trajectoryId: trajectoryContext.trajectoryId,
                jobId,
                timestep: trajectoryContext.timestep,
                status: success ? 'completed' : 'failed'
            }).catch(swallow('Failed to seal frame log', {
                analysisId,
                jobId,
                timestep: trajectoryContext.timestep
            }));
        }

        if (!success) {
            await daemonAnalysisSessionStore.recordFailure(keys);
        }

        const drainResult = await daemonAnalysisSessionStore.decrementAndCheckDrain(keys);
        if (!drainResult.drained) {
            return;
        }

        await this.finalizeAnalysis(analysisId, teamId, drainResult.failedJobs);
    }

    async handleAnalysisJobStatus(input: DaemonAnalysisJobStatusInput): Promise<void> {
        const { jobId, analysisId, status, error } = input;
        const resolved = await daemonJobOwnershipResolver.resolveAnalysisOwnership(input);
        const teamId = resolved.teamId;
        const trajectoryContext = resolved.trajectoryContext;

        if (await daemonAnalysisSessionStore.hasTerminalReceipt(daemonAnalysisSessionStore.analysisKeys(analysisId), jobId)) {
            return;
        }

        if (status === JobStatus.Running && trajectoryContext.timestep !== undefined && trajectoryContext.trajectoryId) {
            await analysisExecutionLogService.markFrameRunning({
                analysisId,
                teamId,
                trajectoryId: trajectoryContext.trajectoryId,
                jobId,
                timestep: trajectoryContext.timestep
            }).catch(swallow('Failed to initialize frame log state', {
                analysisId,
                jobId,
                timestep: trajectoryContext.timestep
            }));
        }

        await this.publisher.publishJobStatusChanged({
            jobId,
            teamId,
            teamClusterId: input.teamClusterId,
            status,
            ...PROJECTED_JOB_KINDS.analysis,
            name: input.name,
            analysisId,
            trajectoryContext,
            error
        });
    }

    async handleAnalysisStageStatus(input: DaemonAnalysisStageStatusInput): Promise<void> {
        const resolved = await daemonJobOwnershipResolver.resolveAnalysisOwnership(input);
        const analysis = resolved.analysis;
        const stage = analysisStageProjection.toAnalysisStage(input, resolved.trajectoryContext.timestep);
        const currentStages = analysis.props.stages ?? [];
        const previousStage = currentStages.find((candidate) => analysisStageProjection.isSameStageIdentity(candidate, stage));
        if (previousStage && analysisStageProjection.shouldIgnoreStaleUpdate(previousStage, stage)) {
            return;
        }

        const stages = analysisStageProjection.upsertStage(currentStages, stage);
        const expectedArtifacts = analysisStageProjection.updateExpectedArtifactsForStage(
            analysis.props.expectedArtifacts ?? [],
            stage,
            input.producedArtifacts
        );
        const childAnalyses = analysisStageProjection.upsertChildAnalysisForStage(
            analysis.props.childAnalyses ?? [],
            stage
        );
        const artifactStatus = analysisStageProjection.resolveArtifactStatusForStage(
            analysis.props.artifactStatus ?? 'pending',
            expectedArtifacts,
            stage
        );

        const updatedAnalysis = await daemonJobOwnershipResolver.updateAnalysisById(analysis._id, {
            artifactStatus,
            expectedArtifacts,
            stages,
            childAnalyses
        }) ?? analysis;

        await this.publisher.publishAnalysisStageChanged(updatedAnalysis, resolved.teamId, resolved.trajectory._id)
            .catch(swallow('Failed to publish analysis.stage.changed', {
                analysisId: analysis._id,
                stageKey: stage.stageKey,
                timestep: stage.timestep
            }));
    }

    async handleRasterJobStatus(input: DaemonRasterJobStatusInput): Promise<void> {
        const resolved = await daemonJobOwnershipResolver.resolveTrajectoryOwnership(input);

        await this.publisher.publishJobStatusChanged({
            jobId: input.jobId,
            teamId: resolved.teamId,
            teamClusterId: input.teamClusterId,
            status: input.status,
            ...PROJECTED_JOB_KINDS.raster,
            name: 'Rasterize trajectory preview',
            trajectoryContext: resolved.trajectoryContext,
            error: input.error
        });

        if (input.status === JobStatus.Completed && resolved.trajectory.props.hasPreview !== true) {
            try {
                await daemonJobOwnershipResolver.updateTrajectoryById(resolved.trajectory._id, { hasPreview: true });
                await eventBus.emit('trajectory.updated', {
                    trajectoryId: resolved.trajectory._id,
                    teamId: resolved.teamId,
                    updates: { hasPreview: true },
                    updatedAt: new Date()
                });
            } catch (error: unknown) {
                logger.warn({
                    err: error,
                    trajectoryId: resolved.trajectory._id
                }, '[DaemonAnalysisCompletion] failed to persist hasPreview after raster completion');
            }
        }
    }

    async handleGlbJobStatus(input: DaemonGlbJobStatusInput): Promise<void> {
        const { jobId, status, error } = input;
        const resolved = await daemonJobOwnershipResolver.resolveTrajectoryOwnership(input);
        const teamId = resolved.teamId;
        const trajectoryId = resolved.trajectory._id;
        const keys = daemonAnalysisSessionStore.glbKeys(trajectoryId);
        const isTerminal = status === JobStatus.Completed || status === JobStatus.Failed;

        if (isTerminal) {
            const accepted = await daemonAnalysisSessionStore.tryMarkTerminalReceipt(keys, jobId, status);
            if (!accepted) {
                return;
            }
        } else if (await daemonAnalysisSessionStore.hasTerminalReceipt(keys, jobId)) {
            return;
        }

        await this.publisher.publishJobStatusChanged({
            jobId,
            teamId,
            teamClusterId: input.teamClusterId,
            status,
            ...PROJECTED_JOB_KINDS.glb,
            name: 'Preprocess trajectory frame',
            trajectoryContext: resolved.trajectoryContext,
            error
        });

        if (!isTerminal) {
            return;
        }

        if (status === JobStatus.Failed) {
            await daemonAnalysisSessionStore.recordFailure(keys);
        }

        const drainResult = await daemonAnalysisSessionStore.decrementAndCheckDrain(keys);
        if (!drainResult.drained) {
            return;
        }

        await this.finalizeGlbSession(trajectoryId, teamId, drainResult.failedJobs);
    }

    async handleArtifactUploadJobStatus(input: DaemonArtifactUploadJobStatusInput): Promise<void> {
        const resolved = await daemonJobOwnershipResolver.resolveAnalysisOwnership(input);
        const updatedAnalysis = await daemonJobOwnershipResolver.updateAnalysisById(input.analysisId, {
            artifactStatus: analysisStageProjection.resolveArtifactStatusForUpload(
                resolved.analysis.props.expectedArtifacts ?? [],
                input.status
            )
        }).catch(swallow('Failed to update artifactStatus from upload job', {
            analysisId: input.analysisId,
            jobId: input.jobId,
            status: input.status
        }));

        if (updatedAnalysis) {
            await this.publisher.publishAnalysisStageChanged(updatedAnalysis, resolved.teamId, resolved.trajectory._id)
                .catch(swallow('Failed to publish analysis.stage.changed after upload status', {
                    analysisId: input.analysisId,
                    jobId: input.jobId
                }));
        }

        await this.publisher.publishJobStatusChanged({
            jobId: input.jobId,
            teamId: resolved.teamId,
            teamClusterId: input.teamClusterId,
            status: input.status,
            ...PROJECTED_JOB_KINDS.artifactUpload,
            name: 'Artifact Upload',
            analysisId: input.analysisId,
            trajectoryContext: resolved.trajectoryContext,
            error: input.error
        });
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
        const currentAnalysis = await daemonJobOwnershipResolver.findAnalysisById(analysisId);
        const closedStages = analysisStageProjection.closeRunningStages(currentAnalysis?.props.stages, status, finishedAt);
        const closedChildAnalyses = analysisStageProjection.closeRunningChildAnalyses(currentAnalysis?.props.childAnalyses, status, finishedAt);
        const closedExpectedArtifacts = analysisStageProjection.closeGeneratingArtifacts(currentAnalysis?.props.expectedArtifacts, status);
        const analysisUpdates: Partial<Analysis['props']> = {
            status,
            finishedAt,
            stages: closedStages,
            childAnalyses: closedChildAnalyses
        };

        if (closedExpectedArtifacts !== currentAnalysis?.props.expectedArtifacts) {
            analysisUpdates.expectedArtifacts = closedExpectedArtifacts;
        }

        const analysis = (await daemonJobOwnershipResolver.updateAnalysisById(analysisId, analysisUpdates)
            .catch(swallow('Failed to finalize analysis status', {
                analysisId,
                status
            }))) ?? currentAnalysis;

        await this.publisher.publishAnalysisStatus({
            analysisId,
            teamId,
            status,
            trajectoryId: analysis?.props.trajectory,
            totalFrames: analysis?.props.totalFrames,
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

    private async setTrajectoryStatus(trajectoryId: string, teamId: string, status: TrajectoryStatus): Promise<void> {
        await daemonJobOwnershipResolver.updateTrajectoryById(trajectoryId, { status });
        await eventBus.emit('trajectory.updated', {
            trajectoryId,
            teamId,
            updates: { status },
            updatedAt: new Date()
        });
    }
}

export default new DaemonAnalysisCompletionService();
