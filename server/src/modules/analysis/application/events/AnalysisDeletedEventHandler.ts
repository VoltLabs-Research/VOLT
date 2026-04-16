import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type IORedis from 'ioredis';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { ISceneArtifactRepository } from '@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository';
import type AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';

const JOB_STATUS_KEY_PREFIX = 'jobs:status:';

interface ProjectedJobStatusRecord {
    analysisId?: string;
    metadata?: Record<string, unknown>;
};

@injectable()
export default class AnalysisDeletedEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository,

        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService)
        private readonly analysisExecutionLogService: AnalysisExecutionLogService
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, teamId } = event.payload;
        const query = { analysis: analysisId };

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
        const [analysisJobIds, teamProjectedJobIds] = await Promise.all([
            this.redis.smembers(this.projectedAnalysisJobsKey(analysisId)),
            teamId ? this.redis.smembers(this.projectedTeamJobsKey(teamId)) : Promise.resolve([])
        ]);
        const indexedTeamJobIds = await this.filterJobIdsByAnalysis(
            this.uniqueJobIds(teamProjectedJobIds),
            analysisId
        );
        const jobIds = this.uniqueJobIds([...analysisJobIds, ...indexedTeamJobIds]);
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

    private async filterJobIdsByAnalysis(jobIds: string[], analysisId: string): Promise<string[]> {
        if (jobIds.length === 0) {
            return [];
        }

        const records = await this.redis.mget(jobIds.map((jobId) => this.jobStatusKey(jobId)));
        const matchingJobIds: string[] = [];

        for (const [index, record] of records.entries()) {
            if (!this.isAnalysisJobRecord(record, analysisId)) {
                continue;
            }

            matchingJobIds.push(jobIds[index]);
        }

        return matchingJobIds;
    }

    private isAnalysisJobRecord(record: string | null, analysisId: string): boolean {
        if (!record) {
            return false;
        }

        try {
            const parsedRecord: unknown = JSON.parse(record);
            if (!this.isProjectedJobStatusRecord(parsedRecord)) {
                return false;
            }

            if (parsedRecord.analysisId === analysisId) {
                return true;
            }

            const metadataAnalysisId = parsedRecord.metadata?.analysisId;

            return typeof metadataAnalysisId === 'string' && metadataAnalysisId === analysisId;
        } catch {
            return false;
        }
    }

    private isProjectedJobStatusRecord(value: unknown): value is ProjectedJobStatusRecord {
        if (!isRecord(value)) {
            return false;
        }

        if (typeof value.analysisId !== 'undefined' && typeof value.analysisId !== 'string') {
            return false;
        }

        return typeof value.metadata === 'undefined' || isRecord(value.metadata);
    }

    private uniqueJobIds(jobIds: string[]): string[] {
        return Array.from(new Set(jobIds));
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
