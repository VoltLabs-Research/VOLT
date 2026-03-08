import logger from '@shared/infrastructure/logger';
import { singleton } from 'tsyringe';
import type { IQueueRegistry, QueueInfo } from '@modules/jobs/domain/port/IQueueRegistry';

@singleton()
export default class QueueRegistry implements IQueueRegistry {
    private queues: Map<string, QueueInfo> = new Map();

    registerQueue(info: QueueInfo): void {
        if (this.queues.has(info.queueName)) {
            logger.warn(`[QueueRegistry] Queue ${info.queueName} is already registered. Skipping.`);
            return;
        }
        this.queues.set(info.queueName, info);
        logger.info(`[QueueRegistry] Registered queue: ${info.queueName}`);
    }

    getAllStatusKeyPrefixes(): string[] {
        return Array.from(new Set(
            Array.from(this.queues.values()).map((queue) => queue.statusKeyPrefix)
        ));
    }

    getQueueInfo(queueName: string): QueueInfo | undefined {
        return this.queues.get(queueName);
    }

    getAllQueues(): QueueInfo[] {
        return Array.from(this.queues.values());
    }
};
