import { DaemonStateEntry, DaemonStateListItem } from '@shared/persistence/daemon-state-model';
import { PluginListingRow } from '@modules/plugin/models/plugin-listing-row-model';
import { PluginSubListingRow } from '@modules/plugin/models/plugin-sub-listing-row-model';
import { QueueJob } from '@shared/queues/queue-job-model';

const ENTITIES: readonly Function[] = [
    PluginListingRow,
    PluginSubListingRow,
    QueueJob,
    DaemonStateEntry,
    DaemonStateListItem
];

export const getDaemonEntities = (): Function[] => [...ENTITIES];
