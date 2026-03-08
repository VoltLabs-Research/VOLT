import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO } from '@modules/analysis/application/dtos/RetryFailedFramesDTO';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IJobQueueService } from '@modules/jobs/domain/port/IJobQueueService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import logger from '@shared/infrastructure/logger';
import { IAnalysisTeamJobsQueryService } from '@modules/analysis/domain/port/IAnalysisTeamJobsQueryService';

@injectable()
export default class RetryFailedFramesUseCase implements IUseCase<RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO, ApplicationError> {
    private readonly queueServices: Map<string, IJobQueueService>;

    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(ANALYSIS_TOKENS.AnalysisTeamJobsQueryService)
        private readonly teamJobsQueryService: IAnalysisTeamJobsQueryService,

        @inject(TRAJECTORY_TOKENS.TrajectoryProcessingQueue)
        trajectoryProcessingQueue: IJobQueueService,

        @inject(TRAJECTORY_TOKENS.CloudUploadQueue)
        cloudUploadQueue: IJobQueueService,

        @inject(RASTER_TOKENS.RasterizerQueue)
        rasterizerQueue: IJobQueueService,

        @inject(PLUGIN_TOKENS.AnalysisProcessingQueue)
        analysisProcessingQueue: IJobQueueService
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

    async execute(input: RetryFailedFramesInputDTO): Promise<Result<RetryFailedFramesOutputDTO, ApplicationError>> {
        const { analysisId, teamId } = input;

        if (!analysisId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis ID is required'
            ));
        }

        if (!teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team ID is required'
            ));
        }

        const analysis = await this.analysisRepository.findById(analysisId);
        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        if (analysis.props.team !== teamId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ACCESS_DENIED,
                'Analysis does not belong to this team'
            ));
        }

        const teamJobs = await this.teamJobsQueryService.getFlatTeamJobs(teamId);

        const failedByQueue = new Map<string, typeof teamJobs>();
        const failedTimesteps: number[] = [];
        let totalFrames = 0;

        for (const job of teamJobs) {
            const jobAnalysisId = job.analysisId || job.metadata?.analysisId;
            if (jobAnalysisId !== analysisId) continue;

            totalFrames++;

            if (job.status !== 'failed') continue;

            const queueType = job.queueType;
            if (!this.queueServices.has(queueType)) {
                logger.warn(`[RetryFailedFramesUseCase] Queue "${queueType}" is not available`);
                continue;
            }

            if (!failedByQueue.has(queueType)) {
                failedByQueue.set(queueType, []);
            }
            failedByQueue.get(queueType)!.push(job);

            const timestep = job.timestep ?? job.metadata?.timestep;
            if (typeof timestep === 'number') {
                failedTimesteps.push(timestep);
            }
        }

        let retriedFrames = 0;
        for (const [queueType, jobs] of failedByQueue.entries()) {
            const queue = this.queueServices.get(queueType);
            if (!queue) continue;

            const retryJobs: Job[] = jobs.map((job) => Job.create({
                jobId: job.jobId as string,
                teamId: job.teamId as string,
                queueType,
                status: JobStatus.Queued,
                sessionId: job.sessionId as string,
                message: job.message as string,
                metadata: job.metadata as Record<string, unknown>
            }));

            retriedFrames += await queue.retryFailedJobs(retryJobs);
        }

        return Result.ok({
            message: retriedFrames > 0
                ? `Successfully re-queued ${retriedFrames} failed frame(s) for analysis`
                : 'No failed frames found for this analysis',
            retriedFrames,
            totalFrames,
            failedTimesteps: failedTimesteps.length > 0 ? failedTimesteps : undefined
        });
    }
}
