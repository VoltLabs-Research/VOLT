import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisExecutionLogService } from '@modules/analysis/domain/port/IAnalysisExecutionLogService';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import type IORedis from 'ioredis';
import { inject } from 'tsyringe';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const JOB_TOMBSTONE_KEY_PREFIX = 'jobs:removed:';

@Subscribe('analysis.deleted')
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository) private readonly sceneArtifactRepository: SceneArtifactRepository,
        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService) private readonly analysisExecutionLogService: IAnalysisExecutionLogService,
        @inject(JOBS_TOKENS.TeamJobMaintenanceService) private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, teamId } = event.payload;
        const query = { analysis: analysisId };

        try {
            await this.teamJobMaintenanceService.cleanupDeletedAnalysis(event.payload);
        } catch (error) {
            logger.warn(error, `[AnalysisDeletedEventHandler] Failed to purge running jobs for analysis ${analysisId}`);
        }

        try {
            await this.removeProjectedJobHistory(analysisId, teamId);
        } catch (error) {
            logger.warn(error, `[AnalysisDeletedEventHandler] Failed to remove projected job history for analysis ${analysisId}`);
        }

        try {
            await this.analysisExecutionLogService.clearRuntimeState(analysisId);
        } catch (error) {
            logger.warn(error, `[AnalysisDeletedEventHandler] Failed to remove runtime frame logs for analysis ${analysisId}`);
        }

        await this.sceneArtifactRepository.deleteMany(query);
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
