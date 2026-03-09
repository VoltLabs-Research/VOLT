import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { ListingRowPrecomputationService } from '@modules/plugin/infrastructure/services/listing-row/ListingRowPrecomputationService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import SessionCompletedEvent, { type SessionFailureSummary } from '@modules/jobs/domain/events/SessionCompletedEvent';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryUpdatedEvent';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';

@injectable()
export default class SessionCompletedEventHandler implements IEventHandler<SessionCompletedEvent> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepo: ITrajectoryRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(PLUGIN_TOKENS.ListingRowPrecomputationService)
        private readonly listingRowPrecomputationService: ListingRowPrecomputationService,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepo: IAnalysisRepository
    ){}

    async handle(event: SessionCompletedEvent): Promise<void> {
        try {
            const { queueType, metadata, teamId, failureSummary } = event.payload;
            const hasSessionFailures = (failureSummary?.failedJobs || 0) > 0;

            if (queueType === 'cloud-upload') {
                await this.handleCloudUploadCompletion(metadata, teamId, hasSessionFailures, failureSummary);
            } else if (queueType === 'analysis_processing') {
                await this.handleAnalysisProcessingCompletion(metadata, teamId, hasSessionFailures, failureSummary);
            } else {
                logger.info(`[SessionCompletedEventHandler] Ignoring session completion for queueType: ${queueType}`);
            }
        } catch (error) {
            logger.error(
                error,
                `[SessionCompletedEventHandler] Unhandled error in handle() for event: ${JSON.stringify(event.payload?.metadata)}`
            );
        }
    }

    /**
     * When cloud-upload completes for a team-cluster trajectory, the daemon has already
     * performed native preprocessing (dump → GLB → rasterization) inline during the
     * upload job. Mark the trajectory as Completed so the frontend can display it.
     *
     * For non-team-cluster (local) trajectories, cloud-upload only stores the dump;
     * processing continues via trajectory_processing → rasterizer queues, so we do
     * nothing here.
     */
    private async handleCloudUploadCompletion(
        metadata: Record<string, unknown> | undefined,
        teamId: string,
        hasSessionFailures: boolean,
        failureSummary: SessionFailureSummary | undefined
    ): Promise<void> {
        const trajectoryId = metadata?.trajectoryId as string | undefined;
        if (!trajectoryId) {
            logger.error('[SessionCompletedEventHandler] Missing trajectoryId in cloud-upload metadata');
            return;
        }

        const teamClusterId = metadata?.teamClusterId as string | undefined;
        if (!teamClusterId) {
            // Non-team-cluster trajectory: the trajectory_processing queue handles the
            // next step. Nothing to do here.
            logger.info(`[SessionCompletedEventHandler] Cloud-upload completed for local trajectory ${trajectoryId}. No status transition needed.`);
            return;
        }

        if (hasSessionFailures) {
            logger.error(
                failureSummary?.lastFailure,
                `[SessionCompletedEventHandler] Cloud-upload failed for trajectory ${trajectoryId}`
            );
            await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Failed);
            return;
        }

        logger.info(`[SessionCompletedEventHandler] Cloud-upload completed for team-cluster trajectory ${trajectoryId}. Marking as completed.`);
        await this.updateTrajectoryStatus(trajectoryId, teamId, TrajectoryStatus.Completed);
    }

    private async handleAnalysisProcessingCompletion(
        metadata: Record<string, unknown> | undefined,
        teamId: string,
        hasSessionFailures: boolean,
        failureSummary: SessionFailureSummary | undefined
    ): Promise<void> {
        const trajectoryId = metadata?.trajectoryId as string | undefined;
        const analysisId = metadata?.analysisId as string | undefined;
        if (!trajectoryId) {
            logger.error('[SessionCompletedEventHandler] Missing trajectoryId in analysis metadata');
            return;
        }

        if (!analysisId) {
            logger.error('[SessionCompletedEventHandler] Missing analysisId in analysis metadata');
            return;
        }

        if (hasSessionFailures) {
            logger.error(
                failureSummary?.lastFailure,
                `[SessionCompletedEventHandler] Analysis processing failed for analysis ${analysisId}`
            );

            await this.analysisRepo.updateById(analysisId, {
                status: 'failed',
                finishedAt: new Date()
            }).catch(() => {});
            // NOTE: Do NOT mark trajectory as Completed when analysis failed.
            return;
        }

        logger.info(`[SessionCompletedEventHandler] Analysis processing completed for ${trajectoryId}. Marking as completed.`);

        let precomputationFailed = false;
        try {
            await this.listingRowPrecomputationService.precomputeForAnalysis({
                analysisId,
                teamId
            });

            await this.analysisRepo.updateById(analysisId, {
                status: 'completed',
                finishedAt: new Date()
            });
        } catch (error) {
            precomputationFailed = true;
            logger.error(`[SessionCompletedEventHandler] Listing precomputation failed for analysis ${analysisId}: ${error}`);

            await this.analysisRepo.updateById(analysisId, {
                status: 'failed',
                finishedAt: new Date()
            }).catch(() => {});
        }

        // Analysis failure doesn't necessarily mean trajectory failed
        const trajectoryStatus = TrajectoryStatus.Completed;
        await this.updateTrajectoryStatus(trajectoryId, teamId, trajectoryStatus);
    }

    private async updateTrajectoryStatus(
        trajectoryId: string,
        teamId: string,
        status: TrajectoryStatus
    ): Promise<void> {
        await this.trajectoryRepo.updateById(trajectoryId, { status });

        await this.eventBus.publish(new TrajectoryUpdatedEvent({
            trajectoryId,
            teamId,
            updates: { status },
            updatedAt: new Date()
        }));
    }
};
