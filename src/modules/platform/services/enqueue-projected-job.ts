import type { QueueService } from './QueueService';

interface EnqueueProjectedJobOptions<T extends Record<string, unknown>> {
    queueService: QueueService;
    queueName: string;
    job: T;
    projectJobStatus: (job: T) => Promise<void>;
    preserveExistingJob?: boolean;
};

export const enqueueProjectedJob = async <T extends Record<string, unknown>>(
    options: EnqueueProjectedJobOptions<T>
): Promise<boolean> => {
    const wasEnqueued = await options.queueService.enqueue(
        options.queueName,
        options.job,
        {
            preserveExistingJob: options.preserveExistingJob
        }
    );

    if (!wasEnqueued) {
        return false;
    }

    await options.projectJobStatus(options.job);
    return true;
};
