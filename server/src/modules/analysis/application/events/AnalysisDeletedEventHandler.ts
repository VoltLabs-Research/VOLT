import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import SceneArtifactRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/scene-artifacts/SceneArtifactRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import type IORedis from 'ioredis';
import { inject } from 'tsyringe';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';

@Subscribe('analysis.deleted')
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        
        private readonly sceneArtifactRepository: SceneArtifactRepository,

        
        private readonly analysisExecutionLogService: AnalysisExecutionLogService,

        
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
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
