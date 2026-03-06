import { injectable, inject } from 'tsyringe';
import { IJobRepository } from '@modules/jobs/domain/port/IJobRepository';
import { IWorkerPoolService } from '@modules/jobs/domain/port/IWorkerPool';
import { ISessionManagerService } from '@modules/jobs/domain/port/ISessionManagerService';
import { IRecoveryManagerService } from '@modules/jobs/domain/port/IRecoveryManagerService';
import { IJobHandlerService } from '@modules/jobs/domain/port/IJobHandlerService';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import logger from '@shared/infrastructure/logger';
import { QUEUE_CONFIG } from '@core/config/queues';
import path from 'path';

@injectable()
export default class AnalysisProcessingQueue extends BaseProcessingQueue {
    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        jobRepository: IJobRepository,

        @inject(JOBS_TOKENS.WorkerPoolService)
        workerPoolService: IWorkerPoolService,

        @inject(JOBS_TOKENS.SessionManagerService)
        sessionManager: ISessionManagerService,

        @inject(JOBS_TOKENS.RecoveryManagerService)
        recoveryManager: IRecoveryManagerService,

        @inject(JOBS_TOKENS.JobHandlerService)
        jobHandler: IJobHandlerService,

        @inject(JOBS_TOKENS.QueueConstants)
        constants: any,

        @inject(SHARED_TOKENS.EventBus)
        eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        queueRegistry: IQueueRegistry
    ) {
        const workerPath = path.join(__dirname, '../workers/AnalysisWorker.ts');
        logger.info(`[AnalysisProcessingQueue] Initializing with worker path: ${workerPath}`);
        super(
            {
                queueName: 'analysis_processing',
                workerPath: workerPath,
                maxConcurrentJobs: QUEUE_CONFIG.analysisMaxConcurrentJobs
            },
            jobRepository,
            workerPoolService,
            sessionManager,
            recoveryManager,
            jobHandler,
            constants,
            eventBus,
            queueRegistry
        );
    }
}
