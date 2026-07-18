import type { RemoveTeamRunningJobsInputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import type { RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import RemoveTeamRunningJobsUseCase, { type RemoveTeamRunningJobsOutputDTO } from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * The single application service for the jobs module. Each method folds a
 * previously separate use case, converting the Result error channel to thrown
 * `ApplicationError`s so Express 5 forwards them to the global error middleware.
 * The underlying use cases are retained because the jobs AI tools
 * (`remove_team_running_jobs`, `retry_team_failed_jobs`) consume them directly;
 * these methods delegate and unwrap the Result for the HTTP path.
 */
@Singleton(JOBS_TOKENS.JobsService)
export default class JobsService {
    constructor(
        @inject(RemoveTeamRunningJobsUseCase) private readonly removeTeamRunningJobsUseCase: RemoveTeamRunningJobsUseCase,
        @inject(RetryTeamFailedJobsUseCase) private readonly retryTeamFailedJobsUseCase: RetryTeamFailedJobsUseCase
    ) {}

    async removeRunningJobs(input: RemoveTeamRunningJobsInputDTO): Promise<RemoveTeamRunningJobsOutputDTO> {
        return this.removeTeamRunningJobsUseCase.execute(input);
    }

    async retryFailedJobs(input: RetryTeamFailedJobsInputDTO): Promise<RetryTeamFailedJobsOutputDTO> {
        return this.retryTeamFailedJobsUseCase.execute(input);
    }
}
