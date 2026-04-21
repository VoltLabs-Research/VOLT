import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import TeamJobProjectionService from '@modules/jobs/infrastructure/services/TeamJobProjectionService';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';

export const jobsDIManifest: ModuleManifest = {
    name: 'jobs',
    singletons: [
        [JOBS_TOKENS.TeamJobMaintenanceService, TeamJobMaintenanceService],
        TeamJobProjectionService,
        RemoveTeamRunningJobsUseCase,
        RetryTeamFailedJobsUseCase
    ]
};
