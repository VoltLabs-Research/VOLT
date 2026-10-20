import type {
    TeamClusterDaemonDiskMetrics,
    TeamClusterDaemonHeartbeatMetrics
} from '@voltstack/daemon-cluster-client';

export type DiskUsageSnapshot = TeamClusterDaemonDiskMetrics;
export type MetricsSnapshot = TeamClusterDaemonHeartbeatMetrics;
