import type { RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import type { ITeamJobMaintenanceService } from '@shared/contracts/ports/ITeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class RetryTeamFailedJobsUseCase implements IUseCase<RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService) private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

    async execute(input: RetryTeamFailedJobsInputDTO): Promise<RetryTeamFailedJobsOutputDTO> {
        const outcome = await this.teamJobMaintenanceService.retryFailedJobsForTrajectory(input.teamId, input.trajectoryId);

        return outcome;
    }
}
