import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import TeamJobQueryService from '@modules/jobs/infrastructure/services/TeamJobQueryService';
import { container } from 'tsyringe';

export const registerJobsDependencies = () => {
    container.registerSingleton(JOBS_TOKENS.TeamJobQueryService, TeamJobQueryService);
    container.registerSingleton(JOBS_TOKENS.TeamJobMaintenanceService, TeamJobMaintenanceService);
    container.registerSingleton(ClearTeamJobsHistoryUseCase);
    container.registerSingleton(RemoveTeamRunningJobsUseCase);
    container.registerSingleton(RetryTeamFailedJobsUseCase);
};
