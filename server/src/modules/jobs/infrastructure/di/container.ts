import { container } from 'tsyringe';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import RedisJobRepository from '@modules/jobs/infrastructure/persistence/RedisJobRepository';
import QueueRegistry from '@modules/jobs/infrastructure/services/QueueRegistry';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import TeamJobQueryService from '@modules/jobs/infrastructure/services/TeamJobQueryService';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';

export const registerJobsDependencies = () => {
    container.registerSingleton(JOBS_TOKENS.JobRepository, RedisJobRepository);
    container.registerSingleton(JOBS_TOKENS.QueueRegistry, QueueRegistry);
    container.registerSingleton(TeamJobQueryService);
    container.registerSingleton(JOBS_TOKENS.TeamJobMaintenanceService, TeamJobMaintenanceService);
    container.registerSingleton(ClearTeamJobsHistoryUseCase);
    container.registerSingleton(RemoveTeamRunningJobsUseCase);
    container.registerSingleton(RetryTeamFailedJobsUseCase);
};
