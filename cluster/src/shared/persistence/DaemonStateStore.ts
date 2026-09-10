import { singleton } from '@shared/utilities/singleton';
import { getDatabaseDialect } from '@shared/persistence/dialect';
import { PostgresDaemonStateStore } from '@shared/persistence/PostgresDaemonStateStore';
import { SqliteDaemonStateStore } from '@shared/persistence/SqliteDaemonStateStore';
import type { DaemonStateStore } from '@shared/persistence/daemon-state-store-contract';

export type { DaemonStateStore } from '@shared/persistence/daemon-state-store-contract';

export const getDaemonStateStore = singleton((): DaemonStateStore =>
    getDatabaseDialect() === 'sqlite' ? new SqliteDaemonStateStore() : new PostgresDaemonStateStore());

export const sweepExpiredDaemonState = (): Promise<number> => getDaemonStateStore().sweepExpired();
