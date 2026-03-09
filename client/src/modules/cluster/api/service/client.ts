import { CLUSTER_SOCKET_EVENTS } from './endpoints/socket-events';
import socketService from '@/modules/socket/core/services/socket-service';
import type { IClusterMetricsSource } from './contracts';
import type { ISocketService } from '@/modules/socket/core/services/contracts/socket-service';
import type { ClusterHistoryMetric, ClusterMetrics } from '../entities/cluster-metrics';

const getSocketService = (): ISocketService => {
    return socketService;
};

export class ClusterSocketMetricsSource implements IClusterMetricsSource {
    private readonly socketService: ISocketService;

    constructor() {
        this.socketService = getSocketService();
    }

    onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void {
        return this.socketService.on(CLUSTER_SOCKET_EVENTS.metricsAll, callback);
    }

    onMetricsHistory(callback: (history: ClusterHistoryMetric[]) => void): () => void {
        return this.socketService.on(CLUSTER_SOCKET_EVENTS.metricsHistory, callback);
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        return this.socketService.onConnectionChange(listener);
    }

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    async requestHistory(minutes: number = 5, clusterId?: string): Promise<void> {
        await this.socketService.emit(CLUSTER_SOCKET_EVENTS.metricsHistory, {
            minutes,
            clusterId
        });
    }
};

let instance: ClusterSocketMetricsSource | null = null;

export const getClusterMetricsSource = (): ClusterSocketMetricsSource => {
    if (!instance) {
        instance = new ClusterSocketMetricsSource();
    }

    return instance;
};
