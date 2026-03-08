import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { QUEUE_CONFIG } from '@core/config/queues';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import { inject, injectable } from 'tsyringe';
import IORedis from 'ioredis';
import path from 'path';
import type { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import type { IEventBus } from '@shared/application/events/IEventBus';

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
};
