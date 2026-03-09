import { QUEUE_CONFIG } from '@core/config/queues';
import { IQueueRegistry } from '@modules/jobs/domain/port/IQueueRegistry';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import BaseProcessingQueue from '@modules/jobs/infrastructure/services/BaseProcessingQueue';
import CloudUploadProcessor from '@modules/trajectory/infrastructure/services/trajectory/CloudUploadProcessor';

import { injectable, inject } from 'tsyringe';
import IORedis from 'ioredis';
import path from 'node:path';

@injectable()
export default class CloudUploadQueue extends BaseProcessingQueue {
    constructor(
        @inject(SHARED_TOKENS.RedisClient)
        redis: IORedis,

        @inject(SHARED_TOKENS.EventBus)
        eventBus: IEventBus,

        @inject(JOBS_TOKENS.QueueRegistry)
        queueRegistry: IQueueRegistry,

        @inject(TRAJECTORY_TOKENS.CloudUploadProcessor)
        cloudUploadProcessor: CloudUploadProcessor
    ) {
        const workerPath = path.join(__dirname, '../workers/CloudUploadWorker.ts');
        super(
            {
                queueName: 'cloud-upload',
                workerPath,
                maxConcurrentJobs: QUEUE_CONFIG.cloudUploadMaxConcurrentJobs,
                withWorker: true,
                inlineProcessor: (job) => cloudUploadProcessor.process(job)
            },
            {
                redis,
                eventBus,
                queueRegistry
            }
        );
    }
};
