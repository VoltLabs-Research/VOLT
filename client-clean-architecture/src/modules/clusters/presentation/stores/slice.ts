import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { ClusterMetrics } from '../../domain/entities/Cluster';
import { getClusterUseCases } from '../../application/registry';
import type { ClusterUseCases } from '../../application/registry';

export interface ClusterState {
    clusters: ClusterMetrics[];
    selectedClusterId: string;
    history: any[];
    isHistoryLoaded: boolean;
    isConnected: boolean;
}

export interface ClusterActions {
    initializeClusterSocket: () => void;
    setSelectedClusterId: (id: string) => void;
    fetchHistory: (range?: number) => void;
    disconnectClusterSocket: () => void;
}

export type ClusterSlice = ClusterState & ClusterActions;

export const initialState: ClusterState = {
    clusters: [],
    selectedClusterId: 'main-cluster',
    history: [],
    isHistoryLoaded: false,
    isConnected: false
};

const resolveUseCases = (): ClusterUseCases => getClusterUseCases();

export const createClusterSlice: SliceCreator<ClusterSlice> = (set, get) => {
    let connectionUnsubscribe: (() => void) | null = null;
    let metricsAllUnsubscribe: (() => void) | null = null;
    let metricsHistoryUnsubscribe: (() => void) | null = null;
    let metricsErrorUnsubscribe: (() => void) | null = null;

    return {
        ...initialState,

        initializeClusterSocket: () => {
            if (connectionUnsubscribe) return;
            const { initializeClusterSocketUseCase } = resolveUseCases();

            const init = initializeClusterSocketUseCase.execute({
                onConnectionChange: (connected) => {
                    set({ isConnected: connected });
                },
                onMetricsAll: (data: ClusterMetrics[]) => {
                    set({ clusters: data });

                    const { selectedClusterId } = get();
                    if (data.length > 0) {
                        const exists = data.some(c => c.clusterId === selectedClusterId);
                        if (!exists || selectedClusterId === 'main-cluster') {
                            set({ selectedClusterId: data[0].clusterId });
                        }
                    }
                },
                onMetricsHistory: (data: any[]) => {
                    set({ history: data, isHistoryLoaded: true });
                },
                onMetricsError: (error: unknown) => {
                    console.error('[ClusterStore] Metrics error:', error);
                },
                onConnectError: (error: unknown) => {
                    console.error('[ClusterStore] Socket connection error:', error);
                }
            });

            set({ isConnected: init.isConnected });

            connectionUnsubscribe = init.subscriptions.offConnection;
            metricsAllUnsubscribe = init.subscriptions.offMetricsAll;
            metricsHistoryUnsubscribe = init.subscriptions.offMetricsHistory;
            metricsErrorUnsubscribe = init.subscriptions.offMetricsError;
        },

        setSelectedClusterId: (id: string) => {
            set({ selectedClusterId: id });
        },

        fetchHistory: (range: number = 15) => {
            const { requestClusterHistoryUseCase } = resolveUseCases();
            requestClusterHistoryUseCase.execute(range);
        },

        disconnectClusterSocket: () => {
            if (connectionUnsubscribe) { connectionUnsubscribe(); connectionUnsubscribe = null; }
            if (metricsAllUnsubscribe) { metricsAllUnsubscribe(); metricsAllUnsubscribe = null; }
            if (metricsHistoryUnsubscribe) { metricsHistoryUnsubscribe(); metricsHistoryUnsubscribe = null; }
            if (metricsErrorUnsubscribe) { metricsErrorUnsubscribe(); metricsErrorUnsubscribe = null; }
        }
    };
};
