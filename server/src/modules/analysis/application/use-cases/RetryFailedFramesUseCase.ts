import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { Result } from '@shared/domain/port/Result';
import { RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO } from '@modules/analysis/application/dtos/RetryFailedFramesDTO';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { IAnalysisTeamJobsQueryService } from '@modules/analysis/domain/port/IAnalysisTeamJobsQueryService';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

@injectable()
export default class RetryFailedFramesUseCase implements IUseCase<RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO, ApplicationError> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(ANALYSIS_TOKENS.AnalysisTeamJobsQueryService)
        private readonly teamJobsQueryService: IAnalysisTeamJobsQueryService,

        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

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

        const teamJobs = await this.teamJobsQueryService.getFlatTeamJobs(teamId);
        const failedTimesteps: number[] = [];
        const failedJobIds: string[] = [];
        let totalFrames = 0;
        let failedFrames = 0;

        for (const job of teamJobs) {
            const jobAnalysisId = job.analysisId || job.metadata?.analysisId;
            if (jobAnalysisId !== analysisId) {
                continue;
            }

            totalFrames += 1;
            if (job.status !== 'failed') {
                continue;
            }

            failedFrames += 1;
            failedJobIds.push(job.jobId);
            const timestep = job.timestep ?? job.metadata?.timestep;
            if (typeof timestep === 'number') {
                failedTimesteps.push(timestep);
            }
        }

        if (totalFrames === 0) {
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
        }

        if (failedFrames === 0) {
            return Result.ok({
                message: 'No failed frames found for this analysis',
                retriedFrames: 0,
                totalFrames,
                failedTimesteps: failedTimesteps.length > 0 ? failedTimesteps : undefined
            });
        }

        const retryResult = await this.teamJobMaintenanceService.retryFailedJobs(teamId, failedJobIds);

        return Result.ok({
            message: retryResult.retriedFrames > 0
                ? `Requested retry for ${retryResult.retriedFrames} failed frame(s)`
                : 'No retriable failed frames found for this analysis',
            retriedFrames: retryResult.retriedFrames,
            totalFrames,
            failedTimesteps: failedTimesteps.length > 0 ? failedTimesteps : undefined
        });
    }
}
