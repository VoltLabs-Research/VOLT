import { singleton } from '@shared/utilities/singleton';
import { getDatabaseDialect } from '@shared/persistence/dialect';
import { LocalQueueNotifier } from '@shared/queues/LocalQueueNotifier';
import { PostgresQueueNotifier } from '@shared/queues/PostgresQueueNotifier';
import type { QueueNotifier } from '@shared/queues/queue-notifier-contract';

export type { QueueNotifier } from '@shared/queues/queue-notifier-contract';

export const getQueueNotifier = singleton((): QueueNotifier =>
    getDatabaseDialect() === 'sqlite' ? new LocalQueueNotifier() : new PostgresQueueNotifier());
