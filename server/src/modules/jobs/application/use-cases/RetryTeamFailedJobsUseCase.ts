import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import BaseTeamJobActionUseCase from '@modules/jobs/application/use-cases/BaseTeamJobActionUseCase';
import { inject, injectable } from 'tsyringe';
import type { RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import type { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';

@injectable()
export default class RetryTeamFailedJobsUseCase extends BaseTeamJobActionUseCase<
    RetryTeamFailedJobsInputDTO,
    RetryTeamFailedJobsOutputDTO
> implements IUseCase<RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO, ApplicationError> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {
        super();
    }

    protected async run(teamId: string): Promise<RetryTeamFailedJobsOutputDTO> {
        return this.teamJobMaintenanceService.retryFailedJobs(teamId);
    }
};
