import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import {
    RemoveTeamRunningJobsInputDTO,
    RemoveTeamRunningJobsOutputDTO,
} from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';

@injectable()
export default class RemoveTeamRunningJobsUseCase implements IUseCase<
    RemoveTeamRunningJobsInputDTO,
    RemoveTeamRunningJobsOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ){}

    async execute(
        input: RemoveTeamRunningJobsInputDTO
    ): Promise<Result<RemoveTeamRunningJobsOutputDTO, ApplicationError>> {
        if (!input.teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team id is required'
            ));
        }

        const result = await this.teamJobMaintenanceService.removeRunningJobs(input.teamId);
        return Result.ok(result);
    }
}
