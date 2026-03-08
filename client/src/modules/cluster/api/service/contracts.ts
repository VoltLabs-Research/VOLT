import type { ClusterHistoryMetric, ClusterMetrics } from '../entities/cluster-metrics';

export interface IClusterMetricsSource {
    onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void;
    onMetricsHistory(callback: (history: ClusterHistoryMetric[]) => void): () => void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    isConnected(): boolean;
    requestHistory(minutes?: number): Promise<void>;
};
