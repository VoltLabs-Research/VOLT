import { singleton } from '@shared/utilities/singleton';
import { getDatabaseDialect } from '@shared/persistence/dialect';
import { PostgresQueueJobStore } from '@shared/queues/PostgresQueueJobStore';
import { SqliteQueueJobStore } from '@shared/queues/SqliteQueueJobStore';
import type { QueueJobStore } from '@shared/queues/queue-job-store-contract';

export const getQueueJobStore = singleton((): QueueJobStore =>
    getDatabaseDialect() === 'sqlite' ? new SqliteQueueJobStore() : new PostgresQueueJobStore());
