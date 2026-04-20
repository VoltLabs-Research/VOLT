import type { Job } from 'bullmq';
import { BaseWorker, type BaseWorkerDependencies } from '@/core/queues/application/BaseWorker';
import type { QueuePayload } from '@/core/queues/application/QueueService';

export interface CreateWorkerOptions<TPayload extends QueuePayload> {
    queueName: string;
    process: (payload: TPayload, bullJob: Job<TPayload>) => Promise<void>;
}

export const createWorker = <TPayload extends QueuePayload>(
    options: CreateWorkerOptions<TPayload>
): new (deps: BaseWorkerDependencies) => BaseWorker<TPayload> => {
    const FactoryWorker = class extends BaseWorker<TPayload> {
        protected readonly queueName = options.queueName;

        protected process(payload: TPayload, bullJob: Job<TPayload>): Promise<void> {
            return options.process(payload, bullJob);
        }
    };

    Object.defineProperty(FactoryWorker, 'name', { value: `${options.queueName}-worker` });
    return FactoryWorker;
};
