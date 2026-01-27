import type { ISocketService } from '@/shared/domain/repositories/ISocketService';
import type { ClusterMetrics } from '../../domain/entities/Cluster';

export interface ClusterSocketCallbacks {
    onConnectionChange: (connected: boolean) => void;
    onMetricsAll: (data: ClusterMetrics[]) => void;
    onMetricsHistory: (data: any[]) => void;
    onMetricsError?: (error: unknown) => void;
    onConnectError?: (error: unknown) => void;
}

export interface ClusterSocketSubscriptions {
    offConnection: () => void;
    offMetricsAll: () => void;
    offMetricsHistory: () => void;
    offMetricsError: () => void;
}

export interface ClusterSocketInitialization {
    isConnected: boolean;
    subscriptions: ClusterSocketSubscriptions;
}

export class InitializeClusterSocketUseCase {
    constructor(private readonly socketService: ISocketService) {}

    execute(callbacks: ClusterSocketCallbacks): ClusterSocketInitialization {
        const offConnection = this.socketService.onConnectionChange((connected) => {
            callbacks.onConnectionChange(connected);
        });

        const offMetricsAll = this.socketService.on('metrics:all', (data: ClusterMetrics[]) => {
            callbacks.onMetricsAll(data);
        });

        const offMetricsHistory = this.socketService.on('metrics:history', (data: any[]) => {
            callbacks.onMetricsHistory(data);
        });

        const offMetricsError = this.socketService.on('metrics:error', (error: unknown) => {
            callbacks.onMetricsError?.(error);
        });

        if (!this.socketService.isConnected()) {
            this.socketService.connect().catch((error) => {
                callbacks.onConnectError?.(error);
            });
        }

        return {
            isConnected: this.socketService.isConnected(),
            subscriptions: {
                offConnection,
                offMetricsAll,
                offMetricsHistory,
                offMetricsError
            }
        };
    }
}
