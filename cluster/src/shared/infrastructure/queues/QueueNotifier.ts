import { singleton } from '@shared/application/utilities/singleton';
import { getDatabaseDialect } from '@shared/infrastructure/persistence/dialect';
import { LocalQueueNotifier } from '@shared/infrastructure/queues/LocalQueueNotifier';
import { PostgresQueueNotifier } from '@shared/infrastructure/queues/PostgresQueueNotifier';
import type { QueueNotifier } from '@shared/infrastructure/queues/queue-notifier-contract';

export type { QueueNotifier } from '@shared/infrastructure/queues/queue-notifier-contract';

export const getQueueNotifier = singleton((): QueueNotifier =>
    getDatabaseDialect() === 'sqlite' ? new LocalQueueNotifier() : new PostgresQueueNotifier());
