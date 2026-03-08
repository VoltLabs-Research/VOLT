import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import BaseTeamJobActionUseCase from '@modules/jobs/application/use-cases/BaseTeamJobActionUseCase';
import { inject, injectable } from 'tsyringe';
import type { ClearTeamJobsHistoryInputDTO, ClearTeamJobsHistoryOutputDTO } from '@modules/jobs/application/dtos/ClearTeamJobsHistoryDTO';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export default class ClearTeamJobsHistoryUseCase extends BaseTeamJobActionUseCase<
    ClearTeamJobsHistoryInputDTO,
    ClearTeamJobsHistoryOutputDTO
> implements IUseCase<ClearTeamJobsHistoryInputDTO, ClearTeamJobsHistoryOutputDTO, ApplicationError> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {
        super();
    }

    protected async run(teamId: string): Promise<ClearTeamJobsHistoryOutputDTO> {
        const result = await this.teamJobMaintenanceService.clearHistory(teamId);

        return {
            deletedJobs: result.deletedJobs,
            deletedAnalyses: result.deletedAnalyses
        };
    }
};
