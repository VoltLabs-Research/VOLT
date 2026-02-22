import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import {
    RetryTeamFailedJobsInputDTO,
    RetryTeamFailedJobsOutputDTO,
} from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';

@injectable()
export default class RetryTeamFailedJobsUseCase implements IUseCase<
    RetryTeamFailedJobsInputDTO,
    RetryTeamFailedJobsOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ){}

    async execute(
        input: RetryTeamFailedJobsInputDTO
    ): Promise<Result<RetryTeamFailedJobsOutputDTO, ApplicationError>> {
        if (!input.teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team id is required'
            ));
        }

        const result = await this.teamJobMaintenanceService.retryFailedJobs(input.teamId);
        return Result.ok(result);
    }
}
