import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type IORedis from 'ioredis';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';

@injectable()
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService)
        private readonly analysisExecutionLogService: AnalysisExecutionLogService,

        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, teamId } = event.payload;
        const query = { analysis: analysisId };

        if (teamId) {
            try {
                await this.teamJobMaintenanceService.removeJobsForAnalysis(teamId, analysisId);
            } catch (error) {
                logger.warn(error, `[AnalysisDeletedEventHandler] Failed to cancel running jobs for analysis ${analysisId}`);
            }
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
        const jobIds = await this.redis.smembers(this.projectedAnalysisJobsKey(analysisId));
        const pipeline = this.redis.pipeline();

        pipeline.del(this.projectedAnalysisJobsKey(analysisId));

        for (const jobId of jobIds) {
            pipeline.del(this.jobStatusKey(jobId));

            if (!teamId) {
                continue;
            }

            pipeline.srem(this.projectedTeamJobsKey(teamId), jobId);
        }

        if (teamId) {
            pipeline.incr(this.projectedTeamJobsRevisionKey(teamId));
        }

        await pipeline.exec();
    }

    private jobStatusKey(jobId: string): string {
        return `${JOB_STATUS_KEY_PREFIX}${jobId}`;
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
};
