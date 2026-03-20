import { CLUSTER_SOCKET_EVENTS } from './endpoints/socket-events';
import socketService from '@/modules/socket/core/services/socket-service';
import type { ClusterHistoryMetric, ClusterMetrics } from '../entities/cluster-metrics';

export interface ClusterMetricsHistoryResponse {
    clusterId: string;
    history: ClusterHistoryMetric[];
};

interface ObserveClusterMetricsHandlers {
    onConnectionChange?: (connected: boolean) => void;
    onMetricsAll?: (clusters: ClusterMetrics[]) => void;
    onMetricsHistory?: (payload: ClusterMetricsHistoryResponse) => void;
};

export const observeClusterMetrics = (handlers: ObserveClusterMetricsHandlers = {}): (() => void) => {
    const cleanups: Array<() => void> = [];

    if (handlers.onConnectionChange) {
        cleanups.push(socketService.onConnectionChange(handlers.onConnectionChange));
    }

    if (handlers.onMetricsAll) {
        cleanups.push(socketService.on(CLUSTER_SOCKET_EVENTS.metricsAll, handlers.onMetricsAll));
    }

    if (handlers.onMetricsHistory) {
        cleanups.push(socketService.on(CLUSTER_SOCKET_EVENTS.metricsHistory, handlers.onMetricsHistory));
    }

    if (handlers.onConnectionChange) {
        handlers.onConnectionChange(socketService.isConnected());
    }

    return () => {
        cleanups.forEach((cleanup) => cleanup());
    };
};

export const requestClusterHistory = async (minutes: number | undefined, clusterId: string): Promise<void> => {
    await socketService.emit(CLUSTER_SOCKET_EVENTS.metricsHistory, {
        minutes: minutes ?? 5,
        clusterId
    });
};
