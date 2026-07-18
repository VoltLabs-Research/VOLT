import redisClient from '@shared/infrastructure/redis/redisClient';
import AnalysisDeletedEvent from '@modules/analysis/events/AnalysisDeletedEvent';
import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import logger from '@shared/infrastructure/logger';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const JOB_TOMBSTONE_KEY_PREFIX = 'jobs:removed:';

class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
        private readonly redis = redisClient;

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, teamId } = event.payload;
        const query = { analysis: analysisId };

        try {
            await teamJobMaintenanceService.cleanupDeletedAnalysis(event.payload);
        } catch (error) {
            logger.warn(error, `[AnalysisDeletedEventHandler] Failed to purge running jobs for analysis ${analysisId}`);
        }

        try {
            await this.removeProjectedJobHistory(analysisId, teamId);
        } catch (error) {
            logger.warn(error, `[AnalysisDeletedEventHandler] Failed to remove projected job history for analysis ${analysisId}`);
        }

        try {
            await analysisExecutionLogService.clearRuntimeState(analysisId);
        } catch (error) {
            logger.warn(error, `[AnalysisDeletedEventHandler] Failed to remove runtime frame logs for analysis ${analysisId}`);
        }

        await SceneArtifactModel.deleteMany(query).exec();
    }

    private async removeProjectedJobHistory(analysisId: string, teamId: string): Promise<void> {
        const [jobIds, terminalKeys] = await Promise.all([
            this.redis.smembers(this.projectedAnalysisJobsKey(analysisId)),
            this.redis.smembers(this.analysisTerminalReceiptSetKey(analysisId))
        ]);
        const pipeline = this.redis.pipeline();

        pipeline.del(this.projectedAnalysisJobsKey(analysisId));
        pipeline.del(this.analysisRemainingKey(analysisId));
        pipeline.del(this.analysisFailedKey(analysisId));
        pipeline.del(this.analysisTerminalReceiptSetKey(analysisId));

        for (const jobId of jobIds) {
            pipeline.del(this.jobStatusKey(jobId));
            pipeline.del(this.jobTombstoneKey(jobId));

            if (!teamId) {
                continue;
            }

            pipeline.srem(this.projectedTeamJobsKey(teamId), jobId);
        }

        if (teamId) {
            pipeline.incr(this.projectedTeamJobsRevisionKey(teamId));
        }

        for (const terminalKey of terminalKeys) {
            pipeline.del(terminalKey);
        }

        await pipeline.exec();
    }

    private jobStatusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
    }

    private jobTombstoneKey(jobId: string): string {
        return `${JOB_TOMBSTONE_KEY_PREFIX}${jobId}`;
    }

    private projectedTeamJobsKey(teamId: string): string {
        return `team:${teamId}:projected-jobs`;
    }

    private projectedTeamJobsRevisionKey(teamId: string): string {
        return `team:${teamId}:projected-jobs:revision`;
    }

    private projectedAnalysisJobsKey(analysisId: string): string {
        return `analysis:${analysisId}:projected-jobs`;
    }

    private analysisRemainingKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:remaining`;
    }

    private analysisFailedKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:failed`;
    }

    private analysisTerminalReceiptSetKey(analysisId: string): string {
        return `daemon-analysis:${analysisId}:terminal-keys`;
    }
}

const analysisDeletedEventHandler = new AnalysisDeletedEventHandler();
subscribeHandler('analysis.deleted', analysisDeletedEventHandler);

export default analysisDeletedEventHandler;
