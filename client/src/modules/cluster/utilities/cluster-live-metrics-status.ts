import { ClusterStatus } from '@/modules/cluster/api/entities/cluster-metrics';
import { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';

export enum ClusterLiveMetricsLabel {
    Healthy = 'Healthy',
    Warning = 'Warning',
    Critical = 'Critical',
    WaitingForLiveMetrics = 'Waiting for live metrics',
    MetricsUnavailable = 'Metrics unavailable'
};

export interface ClusterLiveMetricsStatus {
    label: ClusterLiveMetricsLabel;
    variant: 'success' | 'warning' | 'danger' | 'inactive';
};

export interface GetClusterLiveMetricsStatusParams {
    metrics: ClusterMetrics | null;
    isMetricsConnected: boolean;
};

export interface ClusterMetricsRecoveryState {
    title: string;
    description: string;
    tone: RecoveryStateTone;
};

export interface GetClusterMetricsRecoveryStateParams {
    clusterName: string;
    isMetricsConnected: boolean;
};

const METRIC_STATUS_VARIANTS: Record<ClusterStatus, ClusterLiveMetricsStatus['variant']> = {
    [ClusterStatus.Healthy]: 'success',
    [ClusterStatus.Warning]: 'warning',
    [ClusterStatus.Critical]: 'danger'
};

const METRIC_STATUS_LABELS: Record<ClusterStatus, ClusterLiveMetricsLabel> = {
    [ClusterStatus.Healthy]: ClusterLiveMetricsLabel.Healthy,
    [ClusterStatus.Warning]: ClusterLiveMetricsLabel.Warning,
    [ClusterStatus.Critical]: ClusterLiveMetricsLabel.Critical
};

export const getClusterLiveMetricsStatus = ({
    metrics,
    isMetricsConnected
}: GetClusterLiveMetricsStatusParams): ClusterLiveMetricsStatus => {
    if (!isMetricsConnected) {
        return {
            label: ClusterLiveMetricsLabel.MetricsUnavailable,
            variant: 'inactive'
        };
    }

    if (metrics) {
        return {
            label: METRIC_STATUS_LABELS[metrics.status],
            variant: METRIC_STATUS_VARIANTS[metrics.status]
        };
    }

    return {
        label: ClusterLiveMetricsLabel.WaitingForLiveMetrics,
        variant: 'warning'
    };
};

export const getClusterMetricsRecoveryState = ({
    clusterName,
    isMetricsConnected
}: GetClusterMetricsRecoveryStateParams): ClusterMetricsRecoveryState => {
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
