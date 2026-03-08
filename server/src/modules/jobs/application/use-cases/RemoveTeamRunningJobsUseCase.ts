import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import BaseTeamJobActionUseCase from '@modules/jobs/application/use-cases/BaseTeamJobActionUseCase';
import { inject, injectable } from 'tsyringe';
import type { RemoveTeamRunningJobsInputDTO, RemoveTeamRunningJobsOutputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export default class RemoveTeamRunningJobsUseCase extends BaseTeamJobActionUseCase<
    RemoveTeamRunningJobsInputDTO,
    RemoveTeamRunningJobsOutputDTO
> implements IUseCase<RemoveTeamRunningJobsInputDTO, RemoveTeamRunningJobsOutputDTO, ApplicationError> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {
        super();
    }

    protected async run(teamId: string): Promise<RemoveTeamRunningJobsOutputDTO> {
        const result = await this.teamJobMaintenanceService.removeRunningJobs(teamId);

        return {
            deletedJobs: result.deletedJobs,
            deletedAnalyses: result.deletedAnalyses
        };
    }
};
