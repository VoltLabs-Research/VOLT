import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import TeamJobQueryService from '@modules/jobs/infrastructure/services/TeamJobQueryService';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerJobsDependencies = () => {
    registerModuleDependencies({
        singletons: [
            [JOBS_TOKENS.TeamJobQueryService, TeamJobQueryService],
            [JOBS_TOKENS.TeamJobMaintenanceService, TeamJobMaintenanceService],
            ClearTeamJobsHistoryUseCase,
            RemoveTeamRunningJobsUseCase,
            RetryTeamFailedJobsUseCase
        ]
    });
};
