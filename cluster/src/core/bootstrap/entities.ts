import { DaemonStateEntry, DaemonStateListItem } from '@shared/infrastructure/persistence/daemon-state-model';
import { PluginListingRow } from '@modules/plugin/models/plugin-listing-row-model';
import { PluginSubListingRow } from '@modules/plugin/models/plugin-sub-listing-row-model';
import { QueueJob } from '@shared/infrastructure/queues/queue-job-model';

/**
 * Every entity the daemon's data source registers.
 *
 * The list lives in the composition root because it names concrete modules, and
 * only the bootstrap may do that — the data source itself sits in `shared/` and
 * receives the list rather than reaching for it.
 */
const ENTITIES: readonly Function[] = [
    PluginListingRow,
    PluginSubListingRow,
    QueueJob,
    DaemonStateEntry,
    DaemonStateListItem
];

export const getDaemonEntities = (): Function[] => [...ENTITIES];
