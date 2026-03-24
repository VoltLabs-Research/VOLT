import type { ClusterTransferJob, ClusterTransferJobScopeType, ClusterTransferJobState } from '@/modules/cluster/api/entities/team-cluster-transfer';
import type { StatusBadgeProps } from '@/shared/presentation/components/StatusBadge';

export const OPEN_CLUSTER_TRANSFER_JOB_STATES: ClusterTransferJobState[] = [
    'queued',
    'freezing',
    'copying',
    'verifying',
    'switching',
    'cleaning'
];

export const isClusterTransferJobOpen = (job: ClusterTransferJob): boolean => {
    return OPEN_CLUSTER_TRANSFER_JOB_STATES.includes(job.state);
};

export const getClusterTransferJobStateLabel = (state: ClusterTransferJobState): string => {
    switch (state) {
        case 'queued':
            return 'Queued';
        case 'freezing':
            return 'Freezing';
        case 'copying':
            return 'Copying';
        case 'verifying':
            return 'Verifying';
        case 'switching':
            return 'Switching';
        case 'cleaning':
            return 'Cleaning';
        case 'completed':
            return 'Completed';
        case 'failed':
            return 'Failed';
        case 'cancelled':
            return 'Cancelled';
    }
};

export const getClusterTransferJobStateBadgeVariant = (state: ClusterTransferJobState): StatusBadgeProps['variant'] => {
    switch (state) {
        case 'completed':
            return 'success';
        case 'failed':
            return 'danger';
        case 'cancelled':
            return 'neutral';
        case 'copying':
        case 'verifying':
        case 'switching':
        case 'cleaning':
            return 'brand';
        case 'freezing':
        case 'queued':
            return 'warning';
    }
};

export const getClusterTransferScopeLabel = (scopeType: ClusterTransferJobScopeType): string => {
    switch (scopeType) {
        case 'trajectory':
            return 'Trajectory';
        case 'analysis':
            return 'Analysis';
        case 'plugin-binary':
            return 'Plugin binary';
    }
};

export const getClusterTransferJobSummaryLabel = (job: ClusterTransferJob): string => {
    return `${getClusterTransferScopeLabel(job.scopeType)} ${job.scopeId}`;
};

export const getClusterTransferDirectionLabel = (job: ClusterTransferJob, teamClusterId: string): string => {
    if (job.sourceClusterId === teamClusterId) {
        return 'Outgoing';
    }

    if (job.destinationClusterId === teamClusterId) {
        return 'Incoming';
    }

    return 'Transfer';
};
