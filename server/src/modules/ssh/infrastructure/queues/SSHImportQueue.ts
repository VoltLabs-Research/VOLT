import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { ISSHImportQueue } from '@modules/ssh/domain/port/ISSHImportQueue';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import path from 'path';

@injectable()
export default class SSHImportQueue extends BaseProcessingQueue implements ISSHImportQueue {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        queueRegistry: IQueueRegistry
    ) {
        super(
            {
                queueName: 'ssh_import',
                workerPath: path.join(__dirname, '../workers/SSHImportWorker.ts'),
                maxConcurrentJobs: 2
            },
            redis,
            eventBus,
            queueRegistry
        );
    }
}
