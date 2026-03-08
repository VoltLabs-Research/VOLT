import type { ClusterMetrics, ClusterHistoryMetric, IClusterMetricsSource } from '../api/entities/cluster-metrics';
import { getClusterMetricsSource } from './cluster-metrics-source';

interface ObserveClusterMetricsHandlers {
    onConnectionChange?: (connected: boolean) => void;
    onMetricsAll?: (clusters: ClusterMetrics[]) => void;
    onMetricsHistory?: (history: ClusterHistoryMetric[]) => void;
}

export class ClusterObserver {
    private readonly source: IClusterMetricsSource;

    constructor() {
        this.source = getClusterMetricsSource();
    }

    execute(handlers: ObserveClusterMetricsHandlers = {}): () => void {
        const cleanups = [
            handlers.onConnectionChange
                ? this.source.onConnectionChange(handlers.onConnectionChange)
                : null,
            handlers.onMetricsAll
                ? this.source.onMetricsAll(handlers.onMetricsAll)
                : null,
            handlers.onMetricsHistory
                ? this.source.onMetricsHistory(handlers.onMetricsHistory)
                : null
        ].filter((cleanup): cleanup is () => void => cleanup !== null);

        if (handlers.onConnectionChange) {
            handlers.onConnectionChange(this.source.isConnected());
        }

        return () => {
            cleanups.forEach((cleanup) => cleanup());
        };
    }
}

export const observeClusterMetrics = (): ClusterObserver => {
    return new ClusterObserver();
};

export const requestClusterHistory = async (minutes?: number): Promise<void> => {
    const source = getClusterMetricsSource();
    await source.requestHistory(minutes);
};
