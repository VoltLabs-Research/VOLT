import { ClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

export enum ClusterLiveMetricsLabel {
    Healthy = 'Active',
    Warning = 'Warning',
    Critical = 'Critical',
    WaitingForLiveMetrics = 'Pending',
    MetricsUnavailable = 'Paused'
}

export type ClusterLiveMetricsVariant = 'success' | 'warning' | 'danger' | 'inactive';

interface ClusterLiveMetricsStatus {
    label: ClusterLiveMetricsLabel;
    variant: ClusterLiveMetricsVariant;
}

const METRIC_STATUS: Record<ClusterStatus, ClusterLiveMetricsStatus> = {
    [ClusterStatus.Healthy]: {
        label: ClusterLiveMetricsLabel.Healthy,
        variant: 'success'
    },
    [ClusterStatus.Warning]: {
        label: ClusterLiveMetricsLabel.Warning,
        variant: 'warning'
    },
    [ClusterStatus.Critical]: {
        label: ClusterLiveMetricsLabel.Critical,
        variant: 'danger'
    }
};

export const getClusterLiveMetricsStatus = ({ metrics, isMetricsConnected }: {
    metrics: ClusterMetrics | null;
    isMetricsConnected: boolean;
}): ClusterLiveMetricsStatus => {
    if (!isMetricsConnected) {
        return {
            label: ClusterLiveMetricsLabel.MetricsUnavailable,
            variant: 'inactive'
        };
    }

    if (metrics) {
        return METRIC_STATUS[metrics.status];
    }

    return {
        label: ClusterLiveMetricsLabel.WaitingForLiveMetrics,
        variant: 'warning'
    };
};

export const getClusterMetricsRecoveryState = ({ clusterName, isMetricsConnected }: {
    clusterName: string;
    isMetricsConnected: boolean;
}) => {
    if (!isMetricsConnected) {
        return {
            title: ClusterLiveMetricsLabel.MetricsUnavailable,
            description: 'Unable to connect to the live metrics stream right now.',
            tone: RecoveryStateTone.Error
        };
    }

    return {
        title: ClusterLiveMetricsLabel.WaitingForLiveMetrics,
        description: `${clusterName} has not reported monitoring data yet. It may still be starting up or may be offline.`,
        tone: RecoveryStateTone.Info
    };
};
