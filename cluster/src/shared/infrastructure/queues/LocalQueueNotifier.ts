import { QueueWaiters } from '@shared/infrastructure/queues/QueueWaiters';
import type { QueueNotifier } from '@shared/infrastructure/queues/queue-notifier-contract';

export class LocalQueueNotifier implements QueueNotifier {
    private readonly waiters = new QueueWaiters();

    async notify(queue: string): Promise<void> {
        this.waiters.wake(queue);
    }

    waitForWork(queue: string, timeoutMs: number): Promise<void> {
        return this.waiters.wait(queue, timeoutMs);
    }

    async close(): Promise<void> {
        this.waiters.wakeAll();
    }
}
