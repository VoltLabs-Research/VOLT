import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import {
    ClearTeamJobsHistoryInputDTO,
    ClearTeamJobsHistoryOutputDTO,
} from '@modules/jobs/application/dtos/ClearTeamJobsHistoryDTO';

@injectable()
export default class ClearTeamJobsHistoryUseCase implements IUseCase<
    ClearTeamJobsHistoryInputDTO,
    ClearTeamJobsHistoryOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ){}

    async execute(
        input: ClearTeamJobsHistoryInputDTO
    ): Promise<Result<ClearTeamJobsHistoryOutputDTO, ApplicationError>> {
        if (!input.teamId) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.TEAM_ID_REQUIRED,
                'Team id is required'
            ));
        }

        const result = await this.teamJobMaintenanceService.clearHistory(input.teamId);
        return Result.ok(result);
    }
}
