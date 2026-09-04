import { singleton } from '@shared/application/utilities/singleton';
import { getDatabaseDialect } from '@shared/infrastructure/persistence/dialect';
import { PostgresDaemonStateStore } from '@shared/infrastructure/persistence/PostgresDaemonStateStore';
import { SqliteDaemonStateStore } from '@shared/infrastructure/persistence/SqliteDaemonStateStore';
import type { DaemonStateStore } from '@shared/infrastructure/persistence/daemon-state-store-contract';

export type { DaemonStateStore } from '@shared/infrastructure/persistence/daemon-state-store-contract';

export const getDaemonStateStore = singleton((): DaemonStateStore =>
    getDatabaseDialect() === 'sqlite' ? new SqliteDaemonStateStore() : new PostgresDaemonStateStore());

export const sweepExpiredDaemonState = (): Promise<number> => getDaemonStateStore().sweepExpired();
