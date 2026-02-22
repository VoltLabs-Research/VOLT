import { container } from 'tsyringe';
import { JOBS_TOKENS } from './JobsTokens';
import RedisJobRepository from '@modules/jobs/infrastructure/persistence/RedisJobRepository';
import WorkerPoolService from '@modules/jobs/infrastructure/services/WorkerPoolService';
import SessionManagerService from '@modules/jobs/infrastructure/services/SessionManagerService';
import RecoveryManagerService from '@modules/jobs/infrastructure/services/RecoveryManagerService';
import JobHandlerService from '@modules/jobs/infrastructure/services/JobHandlerService';
import QueueRegistry from '@modules/jobs/infrastructure/services/QueueRegistry';
import TeamJobMaintenanceService from '@modules/jobs/infrastructure/services/TeamJobMaintenanceService';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';

const DEFAULT_QUEUE_CONSTANTS = {
    MIN_WORKERS: 1,
    IDLE_WORKER_TTL_MS: 30000,
    CRASH_WINDOW_MS: 60000,
    MAX_CONSECUTIVE_CRASHES: 5,
    CRASH_BACKOFF_MS: 5000,
    WORKER_MAX_OLD_GENERATION_SIZE_MB: 256,
    SESSION_TTL_SECONDS: 3600,
    STARTUP_LOCK_TTL_MS: 10000,
    TTL_SECONDS: 86400,
    BATCH_SIZE: 10
};

export const registerJobsDependencies = () => {
    container.registerSingleton(JOBS_TOKENS.JobRepository, RedisJobRepository);
    container.registerSingleton(JOBS_TOKENS.QueueRegistry, QueueRegistry);
    container.registerSingleton(TeamJobMaintenanceService);
    container.registerSingleton(ClearTeamJobsHistoryUseCase);
    container.registerSingleton(RemoveTeamRunningJobsUseCase);
    container.registerSingleton(RetryTeamFailedJobsUseCase);

    container.register(JOBS_TOKENS.WorkerPoolService, { useClass: WorkerPoolService });
    container.register(JOBS_TOKENS.SessionManagerService, { useClass: SessionManagerService });
    container.register(JOBS_TOKENS.RecoveryManagerService, { useClass: RecoveryManagerService });
    container.register(JOBS_TOKENS.JobHandlerService, { useClass: JobHandlerService });
    container.register(JOBS_TOKENS.QueueConstants, { useValue: DEFAULT_QUEUE_CONSTANTS });
};
