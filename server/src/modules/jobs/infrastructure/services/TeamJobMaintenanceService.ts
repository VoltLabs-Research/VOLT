import { JobStatus } from '@modules/jobs/domain/entities/Job';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import Job from '@modules/jobs/domain/entities/Job';
import TeamJobQueryService from '@modules/jobs/infrastructure/services/TeamJobQueryService';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import IORedis from 'ioredis';
import type { TeamJobSnapshot } from '@modules/jobs/infrastructure/projections/TeamJobSnapshot';
import type { IJobRepository } from '@modules/jobs/domain/port/IJobRepository';
import type { IJobQueueService } from '@modules/jobs/domain/port/IJobQueueService';
import type { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import type {
    ClearTeamJobsHistoryResult,
    ITeamJobMaintenanceService,
    RemoveTeamRunningJobsResult,
    RetryTeamFailedJobsResult
} from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

const DELETE_BATCH_SIZE = 500;

@injectable()
export default class TeamJobMaintenanceService implements ITeamJobMaintenanceService {
    private readonly queueServices: Map<string, IJobQueueService>;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis,

        @inject(TRAJECTORY_TOKENS.TrajectoryProcessingQueue)
        trajectoryProcessingQueue: IJobQueueService,

        @inject(TRAJECTORY_TOKENS.CloudUploadQueue)
        cloudUploadQueue: IJobQueueService,

        @inject(RASTER_TOKENS.RasterizerQueue)
        rasterizerQueue: IJobQueueService,

        @inject(PLUGIN_TOKENS.AnalysisProcessingQueue)
        analysisProcessingQueue: IJobQueueService,

        private readonly teamJobQueryService: TeamJobQueryService
    ) {
        const queues = [
            trajectoryProcessingQueue,
            cloudUploadQueue,
            rasterizerQueue,
            analysisProcessingQueue
        ];

        this.queueServices = new Map<string, IJobQueueService>();
        for (const queue of queues) {
            this.queueServices.set(queue.getQueueName(), queue);
        }
    }

    async clearHistory(teamId: string): Promise<ClearTeamJobsHistoryResult> {
        const teamJobIds = await this.jobRepository.getTeamJobIds(teamId);
        if (teamJobIds.length === 0) {
            return {
                deletedJobs: 0,
                deletedAnalyses: 0
            };
        }

        const teamJobs = await this.teamJobQueryService.getFlatTeamJobs(teamId);
        const runningByQueue = new Map<string, Set<string>>();

        for (const job of teamJobs) {
            if (job.status !== 'running') continue;
            const queueType = job.queueType;
            if (!runningByQueue.has(queueType)) {
                runningByQueue.set(queueType, new Set());
            }
            runningByQueue.get(queueType)!.add(job.jobId);
        }

        for (const [queueType, ids] of runningByQueue.entries()) {
            const queue = this.queueServices.get(queueType);
            if (!queue) continue;
            await queue.abortRunningJobs(Array.from(ids));
        }

        await this.deleteStatusKeys(teamJobIds);
        await this.jobRepository.deleteTeamJobs(teamId);

        const analysisIds = new Set<string>();
        for (const job of teamJobs) {
            if (typeof job.analysisId === 'string') {
                analysisIds.add(job.analysisId);
                continue;
            }
            if (typeof job.metadata?.analysisId === 'string') {
                analysisIds.add(job.metadata.analysisId);
            }
        }

        return {
            deletedJobs: teamJobIds.length,
            deletedAnalyses: analysisIds.size
        };
    }

    async removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsResult> {
        const teamJobs = await this.teamJobQueryService.getFlatTeamJobs(teamId);
        const runningByQueue = new Map<string, Set<string>>();
        const runningIds = new Set<string>();
        const analysisIds = new Set<string>();

        for (const job of teamJobs) {
            if (job.status !== 'running') continue;

            runningIds.add(job.jobId);
            const queueType = job.queueType;

            if (!runningByQueue.has(queueType)) {
                runningByQueue.set(queueType, new Set());
            }
            runningByQueue.get(queueType)!.add(job.jobId);

            if (typeof job.analysisId === 'string') {
                analysisIds.add(job.analysisId);
            } else if (typeof job.metadata?.analysisId === 'string') {
                analysisIds.add(job.metadata.analysisId);
            }
        }

        if (runningIds.size === 0) {
            return {
                deletedJobs: 0,
                deletedAnalyses: 0
            };
        }

        for (const [queueType, ids] of runningByQueue.entries()) {
            const queue = this.queueServices.get(queueType);
            if (!queue) continue;
            await queue.abortRunningJobs(Array.from(ids));
        }

        const runningIdList = Array.from(runningIds);
        await this.deleteStatusKeys(runningIdList);
        await this.jobRepository.removeFromTeamJobs(teamId, runningIdList);

        return {
            deletedJobs: runningIdList.length,
            deletedAnalyses: analysisIds.size
        };
    }

    async retryFailedJobs(teamId: string): Promise<RetryTeamFailedJobsResult> {
        const teamJobs = await this.teamJobQueryService.getFlatTeamJobs(teamId);
        const failedByQueue = new Map<string, TeamJobSnapshot[]>();
        const failedIds = new Set<string>();

        for (const job of teamJobs) {
            if (job.status !== 'failed') continue;

            const queueType = job.queueType;
            if (!this.queueServices.has(queueType)) {
                logger.warn(`[TeamJobMaintenanceService] Queue "${queueType}" is not available`);
                continue;
            }

            failedIds.add(job.jobId);
            if (!failedByQueue.has(queueType)) {
                failedByQueue.set(queueType, []);
            }
            failedByQueue.get(queueType)!.push(job);
        }

        if (failedIds.size === 0) {
            return { retriedFrames: 0 };
        }

        let retriedFrames = 0;
        for (const [queueType, jobs] of failedByQueue.entries()) {
            const queue = this.queueServices.get(queueType);
            if (!queue) continue;

            const retryJobs: Job[] = jobs.map((job) => Job.create({
                jobId: job.jobId,
                teamId: job.teamId,
                queueType,
                status: JobStatus.Queued,
                sessionId: job.sessionId,
                message: job.message,
                metadata: job.metadata || {}
            }));

            retriedFrames += await queue.retryFailedJobs(retryJobs);
        }

        return { retriedFrames };
    }

    private async deleteStatusKeys(jobIds: string[]): Promise<void> {
        const prefixes = this.queueRegistry.getAllStatusKeyPrefixes();
        const allKeys = prefixes.flatMap((prefix) =>
            jobIds.map((jobId) => `${prefix}${jobId}`)
        );

        for (let i = 0; i < allKeys.length; i += DELETE_BATCH_SIZE) {
            const batch = allKeys.slice(i, i + DELETE_BATCH_SIZE);
            const pipeline = this.redis.pipeline();
            for (const key of batch) {
                pipeline.del(key);
            }
            await pipeline.exec();
        }
    }
};
