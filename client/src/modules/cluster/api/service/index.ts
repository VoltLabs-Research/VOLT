import { getClusterMetricsSource } from './client';
import type { ClusterHistoryMetric, ClusterMetrics } from '../entities/cluster-metrics';
import type { IClusterMetricsSource } from './contracts';

interface ObserveClusterMetricsHandlers {
    onConnectionChange?: (connected: boolean) => void;
    onMetricsAll?: (clusters: ClusterMetrics[]) => void;
    onMetricsHistory?: (history: ClusterHistoryMetric[]) => void;
};

export class ClusterObserver {
    private readonly source: IClusterMetricsSource;

    constructor() {
        this.source = getClusterMetricsSource();
    }

    execute(handlers: ObserveClusterMetricsHandlers = {}): () => void {
        const cleanups: Array<() => void> = [];

        if (handlers.onConnectionChange) {
            cleanups.push(this.source.onConnectionChange(handlers.onConnectionChange));
        }

        if (handlers.onMetricsAll) {
            cleanups.push(this.source.onMetricsAll(handlers.onMetricsAll));
        }

        if (handlers.onMetricsHistory) {
            cleanups.push(this.source.onMetricsHistory(handlers.onMetricsHistory));
        }

        if (handlers.onConnectionChange) {
            handlers.onConnectionChange(this.source.isConnected());
        }

        return () => {
            cleanups.forEach((cleanup) => cleanup());
        };
    }
};

export const observeClusterMetrics = (): ClusterObserver => {
    return new ClusterObserver();
};

export const requestClusterHistory = async (minutes?: number, clusterId?: string): Promise<void> => {
    const source = getClusterMetricsSource();
    await source.requestHistory(minutes, clusterId);
};
