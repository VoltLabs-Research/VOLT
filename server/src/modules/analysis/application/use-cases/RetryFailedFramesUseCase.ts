import { ErrorCodes } from '@core/constants/error-codes';
import { RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO } from '@modules/analysis/application/dtos/RetryFailedFramesDTO';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import TeamJobsService from '@modules/team/socket/team/TeamJobsService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class RetryFailedFramesUseCase implements IUseCase<RetryFailedFramesInputDTO, RetryFailedFramesOutputDTO, ApplicationError> {
    constructor(
        private readonly analysisRepository: AnalysisRepository,
        private readonly teamJobsService: TeamJobsService,
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ) {}

    async execute(input: RetryFailedFramesInputDTO): Promise<Result<RetryFailedFramesOutputDTO, ApplicationError>> {
        const { analysisId, teamId } = input;

        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);
        const failedTimesteps: number[] = [];
        const failedJobIds: string[] = [];
        let totalFrames = 0;
        let failedFrames = 0;

        for (const job of teamJobs) {
            if (job.analysisId !== analysisId) {
                continue;
            }

            totalFrames += 1;
            if (job.status !== 'failed') {
                continue;
            }

            failedFrames += 1;
            failedJobIds.push(job.jobId);
            const timestep = job.timestep;
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

        const retryResult = await this.teamJobMaintenanceService.retryJobs(teamId, failedJobIds);

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
