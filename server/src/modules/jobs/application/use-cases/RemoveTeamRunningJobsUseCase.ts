import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { RemoveTeamRunningJobsInputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import type { ITeamJobMaintenanceService, RemoveTeamJobsResult } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';

@injectable()
export default class RemoveTeamRunningJobsUseCase implements IUseCase<RemoveTeamRunningJobsInputDTO, RemoveTeamJobsResult, ApplicationError> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService)
        private readonly teamJobMaintenanceService: ITeamJobMaintenanceService
    ) {}

    async execute(input: RemoveTeamRunningJobsInputDTO): Promise<Result<RemoveTeamJobsResult, ApplicationError>> {
        const outcome = await this.teamJobMaintenanceService.removeJobsForTrajectory(input.teamId, input.trajectoryId);

        return Result.ok(outcome);
    }
};
