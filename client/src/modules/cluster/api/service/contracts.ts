import type { ClusterHistoryMetric, ClusterMetrics } from '../entities/cluster-metrics';

export interface ClusterMetricsHistoryResponse {
    clusterId: string;
    history: ClusterHistoryMetric[];
};

export interface IClusterMetricsSource {
    onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void;
    onMetricsHistory(callback: (payload: ClusterMetricsHistoryResponse) => void): () => void;
    onConnectionChange(listener: (connected: boolean) => void): () => void;
    isConnected(): boolean;
    requestHistory(minutes: number | undefined, clusterId: string): Promise<void>;
};
