import { inject, injectable } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import {
    RetryTeamFailedJobsInputDTO,
    RetryTeamFailedJobsOutputDTO,
} from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import { ITeamJobMaintenanceService } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import BaseTeamJobActionUseCase from '@modules/jobs/application/use-cases/BaseTeamJobActionUseCase';

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
        const result = await this.teamJobMaintenanceService.retryFailedJobs(teamId);

        return {
            retriedFrames: result.retriedFrames
        };
    }
}
