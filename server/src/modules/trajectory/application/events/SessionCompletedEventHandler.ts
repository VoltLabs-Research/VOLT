import { IEventHandler } from '@shared/application/events/IEventHandler';
import SessionCompletedEvent from '@modules/jobs/application/events/SessionCompletedEvent';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { ITrajectoryRepository } from '@modules/trajectory/domain/port/ITrajectoryRepository';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/Trajectory';
import { SHARED_TOKENS } from '@shared/application/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import TrajectoryUpdatedEvent from '@modules/trajectory/domain/events/TrajectoryUpdatedEvent';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import { ListingRowPrecomputationService } from '@modules/plugin/infrastructure/services/ListingRowPrecomputationService';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

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

            if (queueType === 'analysis_processing') {
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

                // Only mark trajectory as Completed if analysis succeeded
                const trajectoryStatus = precomputationFailed
                    ? TrajectoryStatus.Completed  // Analysis failure doesn't necessarily mean trajectory failed
                    : TrajectoryStatus.Completed;

                await this.trajectoryRepo.updateById(trajectoryId, { status: trajectoryStatus });

                await this.eventBus.publish(new TrajectoryUpdatedEvent({
                    trajectoryId,
                    teamId,
                    updates: {
                        status: trajectoryStatus
                    },
                    updatedAt: new Date()
                }));
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
}
