import type { RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO } from '@modules/jobs/application/dtos/RetryTeamFailedJobsDTO';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class RetryTeamFailedJobsUseCase implements IUseCase<RetryTeamFailedJobsInputDTO, RetryTeamFailedJobsOutputDTO, ApplicationError> {
    constructor(
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ) {}

    async execute(input: RetryTeamFailedJobsInputDTO): Promise<Result<RetryTeamFailedJobsOutputDTO, ApplicationError>> {
        const outcome = await this.teamJobMaintenanceService.retryFailedJobsForTrajectory(input.teamId, input.trajectoryId);

        return Result.ok(outcome);
    }
}
