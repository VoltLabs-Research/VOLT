import type {
    TeamClusterDaemonDiskMetrics,
    TeamClusterDaemonHeartbeatMetrics
} from '@voltstack/daemon-cluster-client';

/**
 * The system metrics snapshot is the heartbeat wire contract, owned by
 * `@voltstack/daemon-cluster-client`; these aliases keep the historical local
 * names used by the metrics collector.
 */
export type DiskUsageSnapshot = TeamClusterDaemonDiskMetrics;
export type MetricsSnapshot = TeamClusterDaemonHeartbeatMetrics;
