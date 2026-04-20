import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';

@injectable()
export default class RetryTeamFailedJobsUseCase implements IUseCase<RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO, ApplicationError> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

    async execute(input: RetryTeamFailedJobsInputDTO): Promise<Result<RetryTeamFailedJobsOutputDTO, ApplicationError>> {
        const outcome = await this.teamJobMaintenanceService.retryFailedJobsForTrajectory(input.teamId, input.trajectoryId);

        return Result.ok(outcome);
    }
};
