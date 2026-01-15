import { injectable, inject } from 'tsyringe';
import BaseProcessingQueue from '@/src/modules/jobs/infrastructure/services/BaseProcessingQueue';
import { IJobRepository } from '@/src/modules/jobs/domain/ports/IJobRepository';
import { IWorkerPoolService } from '@/src/modules/jobs/domain/ports/IWorkerPool';
import { ISessionManagerService } from '@/src/modules/jobs/domain/ports/ISessionManagerService';
import { IRecoveryManagerService } from '@/src/modules/jobs/domain/ports/IRecoveryManagerService';
import { IJobHandlerService } from '@/src/modules/jobs/domain/ports/IJobHandlerService';
import { IEventBus } from '@/src/shared/application/events/IEventBus';
import { JOBS_TOKENS } from '@/src/modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import path from 'path';

@injectable()
export default class SSHImportQueue extends BaseProcessingQueue{
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
        eventBus: IEventBus
    ) {
        super(
            {
                queueName: 'ssh_import',
                workerPath: path.join(__dirname, '../workers/SSHImportWorker.js'),
                maxConcurrentJobs: 2
            },
            jobRepository,
            workerPoolService,
            sessionManager,
            recoveryManager,
            jobHandler,
            constants,
            eventBus
        );
    }
};
