import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterQueueConcurrencyProps } from '@modules/cluster/domain/entities/TeamCluster';

export type GetTeamClusterRuntimeSnapshotInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface QueueCountsSnapshot {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
}

export interface DaemonQueueSnapshotEntry {
    name: string;
    counts: QueueCountsSnapshot;
}

export interface ServerQueueSnapshotEntry {
    name: string;
    location: 'server';
    concurrency: number;
}

export interface GetTeamClusterRuntimeSnapshotOutputDTO {
    capturedAt: string;
    queueConcurrency: TeamClusterQueueConcurrencyProps;
    daemonQueues: DaemonQueueSnapshotEntry[];
    serverQueues: ServerQueueSnapshotEntry[];
}
