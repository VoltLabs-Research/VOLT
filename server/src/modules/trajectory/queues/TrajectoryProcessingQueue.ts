import { QUEUE_CONFIG } from '@core/config/queues';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import path from 'path';

@injectable()
export default class TrajectoryProcessingQueue extends BaseProcessingQueue {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        queueRegistry: IQueueRegistry
    ) {
        const workerPath = path.join(__dirname, '../workers/TrajectoryProcessingWorker.ts');
        logger.info(`[TrajectoryProcessingQueue] Initializing with worker path: ${workerPath}`);
        super(
            {
                queueName: 'trajectory_processing',
                workerPath,
                maxConcurrentJobs: QUEUE_CONFIG.trajectoryMaxConcurrentJobs,
                withWorker: false
            },
            {
                redis,
                eventBus,
                queueRegistry
            }
        );
    }
};
