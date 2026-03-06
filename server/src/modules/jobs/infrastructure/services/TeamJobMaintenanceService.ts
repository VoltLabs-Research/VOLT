import { inject, injectable } from 'tsyringe';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IJobRepository } from '@modules/jobs/domain/port/IJobRepository';
import { IJobQueueService } from '@modules/jobs/domain/port/IJobQueueService';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { ClearTeamJobsHistoryOutputDTO } from '@modules/jobs/application/dtos/ClearTeamJobsHistoryDTO';
import { RemoveTeamRunningJobsOutputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import { RetryTeamFailedJobsOutputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import TeamJobsService from '@modules/team/infrastructure/socket/TeamJobsService';
import logger from '@shared/infrastructure/logger';

const DELETE_BATCH_SIZE = 500;
const JOB_RETRY_KEY_PREFIX = 'job:retries:';

@injectable()
export default class TeamJobMaintenanceService {
    private readonly queueServices: Map<string, IJobQueueService>;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.QueueRegistry)
        private readonly queueRegistry: IQueueRegistry,

        @inject(TRAJECTORY_TOKENS.TrajectoryProcessingQueue)
        trajectoryProcessingQueue: IJobQueueService,

        @inject(TRAJECTORY_TOKENS.CloudUploadQueue)
        cloudUploadQueue: IJobQueueService,

        @inject(RASTER_TOKENS.RasterizerQueue)
        rasterizerQueue: IJobQueueService,

        @inject(PLUGIN_TOKENS.AnalysisProcessingQueue)
        analysisProcessingQueue: IJobQueueService,

        @inject(TeamJobsService)
        private readonly teamJobsService: TeamJobsService
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

    async clearHistory(teamId: string): Promise<ClearTeamJobsHistoryOutputDTO> {
        const teamJobIds = await this.jobRepository.getTeamJobIds(teamId);
        if (teamJobIds.length === 0) {
            return { deletedJobs: 0, deletedAnalyses: 0 };
        }

        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
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

        await this.removeFromQueueLists(new Set(teamJobIds));
        await this.deleteStatusAndRetryKeys(teamJobIds);
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

    async removeRunningJobs(teamId: string): Promise<RemoveTeamRunningJobsOutputDTO> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
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
            return { deletedJobs: 0, deletedAnalyses: 0 };
        }

        for (const [queueType, ids] of runningByQueue.entries()) {
            const queue = this.queueServices.get(queueType);
            if (!queue) continue;
            await queue.abortRunningJobs(Array.from(ids));
        }

        const runningIdList = Array.from(runningIds);
        await this.removeFromQueueLists(new Set(runningIdList));
        await this.deleteStatusAndRetryKeys(runningIdList);
        await this.jobRepository.removeFromTeamJobs(teamId, runningIdList);

        return {
            deletedJobs: runningIdList.length,
            deletedAnalyses: analysisIds.size
        };
    }

    async retryFailedJobs(teamId: string): Promise<RetryTeamFailedJobsOutputDTO> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        const failedByQueue = new Map<string, any[]>();
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

        await this.removeFromQueueLists(failedIds);

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
                metadata: job.metadata
            }));

            await queue.addJobs(retryJobs);
            retriedFrames += retryJobs.length;
        }

        await this.deleteRetryKeys(Array.from(failedIds));
        return { retriedFrames };
    }

    private async removeFromQueueLists(jobIds: Set<string>): Promise<void> {
        const listKeys = this.queueRegistry.getAllQueues()
            .flatMap((queue) => [queue.queueKey, queue.processingKey]);

        for (const listKey of listKeys) {
            const entries = await this.jobRepository.getListRange(listKey, 0, -1);
            for (const entry of entries) {
                const parsed = JSON.parse(entry);
                const jobId = parsed.props?.jobId ?? parsed.jobId;
                if (!jobIds.has(jobId)) continue;
                await this.jobRepository.removeFromList(listKey, entry);
            }
        }
    }

    private async deleteStatusAndRetryKeys(jobIds: string[]): Promise<void> {
        const statusKeys = this.queueRegistry.getAllQueues()
            .flatMap((queue) => jobIds.map((jobId) => `${queue.statusKeyPrefix}${jobId}`));

        await this.deleteKeys([
            ...statusKeys,
            ...jobIds.map((jobId) => `${JOB_RETRY_KEY_PREFIX}${jobId}`)
        ]);
    }

    private async deleteRetryKeys(jobIds: string[]): Promise<void> {
        await this.deleteKeys(jobIds.map((jobId) => `${JOB_RETRY_KEY_PREFIX}${jobId}`));
    }

    private async deleteKeys(keys: string[]): Promise<void> {
        for (let i = 0; i < keys.length; i += DELETE_BATCH_SIZE) {
            const pipeline = this.jobRepository.pipeline();
            keys.slice(i, i + DELETE_BATCH_SIZE).forEach((key) => pipeline.del(key));
            await pipeline.exec();
        }
    }
}
