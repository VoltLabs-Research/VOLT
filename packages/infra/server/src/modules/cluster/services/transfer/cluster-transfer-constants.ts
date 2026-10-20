import { ClusterTransferJobState as ClusterTransferJobStateColumn } from '@modules/cluster/contracts/cluster-transfer-job';

import type { ClusterTransferJobState } from '@volt/contracts/modules/cluster/domain';

export const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobStateColumn[] = [
    ClusterTransferJobStateColumn.Queued,
    ClusterTransferJobStateColumn.Freezing,
    ClusterTransferJobStateColumn.Copying,
    ClusterTransferJobStateColumn.Verifying,
    ClusterTransferJobStateColumn.Switching,
    ClusterTransferJobStateColumn.Cleaning
];

export const isOpenTransferJobState = (state: ClusterTransferJobState): boolean => {
    return (OPEN_TRANSFER_JOB_STATES as string[]).includes(state);
};

export const CLUSTER_TRANSFER_QUEUE_TYPE = 'cluster_transfer';
export const CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_ID = 'cluster-transfer-operations';
export const CLUSTER_TRANSFER_FALLBACK_TRAJECTORY_NAME = 'Cluster Transfers';
export const CLUSTER_TRANSFER_CLAIM_TTL_MS = 5 * 60 * 1000;
export const CLUSTER_TRANSFER_CLAIM_RENEW_INTERVAL_MS = 60 * 1000;
export const CLUSTER_TRANSFER_WORKER_ID = `${process.pid}:${Math.random().toString(36).slice(2, 10)}`;
export const TRANSFER_PROGRESS_FLUSH_EVERY_OBJECTS = 50;
export const TRANSFER_PROGRESS_FLUSH_EVERY_BYTES = 64 * 1024 * 1024;
