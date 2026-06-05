import type { RemoveTeamRunningJobsInputDTO } from '@modules/jobs/application/dtos/RemoveTeamRunningJobsDTO';
import type { ITeamJobMaintenanceService, RemoveTeamJobsResult } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import TeamJobsRealtimeSyncService from '@modules/team/socket/team/TeamJobsRealtimeSyncService';
import type { TeamJobsInitialPayload } from '@modules/team/socket/team/TeamJobsService';
import type { IUseCase } from '@shared/application/IUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

export interface RemoveTeamRunningJobsOutputDTO extends RemoveTeamJobsResult, TeamJobsInitialPayload {}

@Singleton()
export default class RemoveTeamRunningJobsUseCase implements IUseCase<RemoveTeamRunningJobsInputDTO, RemoveTeamRunningJobsOutputDTO, ApplicationError> {
    constructor(
        @inject(JOBS_TOKENS.TeamJobMaintenanceService) private readonly teamJobMaintenanceService: ITeamJobMaintenanceService,
        private readonly teamJobsRealtimeSyncService: TeamJobsRealtimeSyncService
    ) {}

    async execute(input: RemoveTeamRunningJobsInputDTO): Promise<Result<RemoveTeamRunningJobsOutputDTO, ApplicationError>> {
        const outcome = await this.teamJobMaintenanceService.removeJobsForTrajectory(input.teamId, input.trajectoryId);
        const snapshot = await this.teamJobsRealtimeSyncService.broadcastSnapshot(input.teamId);

        return Result.ok({
            ...outcome,
            ...snapshot
        });
    }
}
