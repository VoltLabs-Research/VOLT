import { container } from 'tsyringe';
import { JOBS_TOKENS } from './JobsTokens';
import RedisJobRepository from '../persistence/RedisJobRepository';
import WorkerPoolService from '../services/WorkerPoolService';
import SessionManagerService from '../services/SessionManagerService';
import RecoveryManagerService from '../services/RecoveryManagerService';
import JobHandlerService from '../services/JobHandlerService';
import TrajectoryJobsService from '../services/TrajectoryJobsService';
import QueueRegistry from '../services/QueueRegistry';

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
    container.registerSingleton(JOBS_TOKENS.TrajectoryJobsService, TrajectoryJobsService);
    container.registerSingleton(JOBS_TOKENS.QueueRegistry, QueueRegistry);

    container.register(JOBS_TOKENS.WorkerPoolService, { useClass: WorkerPoolService });
    container.register(JOBS_TOKENS.SessionManagerService, { useClass: SessionManagerService });
    container.register(JOBS_TOKENS.RecoveryManagerService, { useClass: RecoveryManagerService });
    container.register(JOBS_TOKENS.JobHandlerService, { useClass: JobHandlerService });
    container.register(JOBS_TOKENS.QueueConstants, { useValue: DEFAULT_QUEUE_CONSTANTS });
};