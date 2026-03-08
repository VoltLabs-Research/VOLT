import type { ISocketService } from '@/modules/socket/api/entities/socket-service';
import socketService from '@/modules/socket/services/socket-service';
import type { ClusterMetrics, ClusterHistoryMetric, IClusterMetricsSource } from '../api/entities/cluster-metrics';
import { SOCKET_EVENTS } from '../api/entities/cluster-constants';

const getSocketService = (): ISocketService => {
    return socketService;
};

export class ClusterSocketMetricsSource implements IClusterMetricsSource {
    private readonly socketService: ISocketService;

    constructor() {
        this.socketService = getSocketService();
    }

    onMetricsAll(callback: (clusters: ClusterMetrics[]) => void): () => void {
        return this.socketService.on(SOCKET_EVENTS.metricsAll, callback as (...args: unknown[]) => void);
    }

    onMetricsHistory(callback: (history: ClusterHistoryMetric[]) => void): () => void {
        return this.socketService.on(SOCKET_EVENTS.metricsHistory, callback as (...args: unknown[]) => void);
    }

    onConnectionChange(listener: (connected: boolean) => void): () => void {
        return this.socketService.onConnectionChange(listener);
    }

    isConnected(): boolean {
        return this.socketService.isConnected();
    }

    async requestHistory(minutes: number = 5): Promise<void> {
        await this.socketService.emit(SOCKET_EVENTS.metricsHistory, minutes);
    }
}

let instance: ClusterSocketMetricsSource | null = null;

export const getClusterMetricsSource = (): ClusterSocketMetricsSource => {
    if (!instance) {
        instance = new ClusterSocketMetricsSource();
    }
    return instance;
};
