import type { RemoveTeamRunningJobsInputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import type { RemoveTeamJobsResult } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class RemoveTeamRunningJobsUseCase implements IUseCase<RemoveTeamRunningJobsInputDTO, RemoveTeamJobsResult, ApplicationError> {
    constructor(
        private readonly teamJobMaintenanceService: TeamJobMaintenanceService
    ) {}

    async execute(input: RemoveTeamRunningJobsInputDTO): Promise<Result<RemoveTeamJobsResult, ApplicationError>> {
        const outcome = await this.teamJobMaintenanceService.removeJobsForTrajectory(input.teamId, input.trajectoryId);

        return Result.ok(outcome);
    }
}
