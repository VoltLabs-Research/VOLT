import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import { QUEUE_CONFIG } from '@core/config/queues';
import path from 'path';

@injectable()
export default class RasterizerQueue extends BaseProcessingQueue {
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
                queueName: 'rasterizer',
                workerPath: path.join(__dirname, '../workers/HeadlessRasterizerWorker.ts'),
                maxConcurrentJobs: QUEUE_CONFIG.rasterizerMaxConcurrentJobs
            },
            redis,
            eventBus,
            queueRegistry
        );
    }
}
