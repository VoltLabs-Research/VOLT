import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import { QUEUE_CONFIG } from '@core/config/queues';
import path from 'node:path';

@injectable()
export default class CloudUploadQueue extends BaseProcessingQueue {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        queueRegistry: IQueueRegistry
    ) {
        const workerPath = path.join(__dirname, '../workers/CloudUploadWorker.ts');
        super(
            {
                queueName: 'cloud-upload',
                workerPath,
                maxConcurrentJobs: QUEUE_CONFIG.cloudUploadMaxConcurrentJobs
            },
            redis,
            eventBus,
            queueRegistry
        );
    }
}
