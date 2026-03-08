import { useClusterStore } from '../stores/use-cluster-store';
import {
    clusterHistoryLoadedQuery,
    clusterHistoryQuery,
    clusterMetricsQuery,
    resetClusterHistoryQuery,
    setClusterHistoryQueryData,
    setClusterMetricsQueryData
} from './queries';
import { observeClusterMetrics, requestClusterHistory } from '../api/service';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback, useEffect, useRef } from 'react';

const useClusterMetrics = () => {
    const queryClient = useQueryClient();
    const requestedHistoryClusterIdRef = useRef<string | null>(null);

    const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
    const isConnected = useClusterStore((state) => state.isConnected);
    const setSelectedClusterId = useClusterStore((state) => state.setSelectedClusterId);
    const setConnected = useClusterStore((state) => state.setConnected);

    useEffect(() => {
        resetClusterHistoryQuery(queryClient);
    }, [queryClient]);
    useEffect(() => {
        return observeClusterMetrics().execute({
            onConnectionChange: (connected) => {
                setConnected(connected);

                if (!connected) {
                    resetClusterHistoryQuery(queryClient);
                }
            },
            onMetricsAll: (clusters) => {
                setClusterMetricsQueryData(queryClient, clusters);

                const state = useClusterStore.getState();
                const currentExists = clusters.some((cluster) => cluster.clusterId === state.selectedClusterId);
                if (!currentExists && clusters.length > 0) {
                    state.setSelectedClusterId(clusters[0].clusterId);
                }
            },
            onMetricsHistory: (history) => {
                setClusterHistoryQueryData(
                    queryClient,
                    history,
                    requestedHistoryClusterIdRef.current ?? useClusterStore.getState().selectedClusterId
                );
                requestedHistoryClusterIdRef.current = null;
            }
        });
    }, [queryClient, setConnected]);

    const { data: clusters = [] } = clusterMetricsQuery(undefined);
    const { data: history = [] } = clusterHistoryQuery(selectedClusterId);
    const { data: isHistoryLoaded = false } = clusterHistoryLoadedQuery(selectedClusterId);

    const metrics = useMemo(() => {
        if (!clusters.length) return null;
        return clusters.find((c) => c.clusterId === selectedClusterId) || null;
    }, [clusters, selectedClusterId]);

    const handleRequestHistory = useCallback((minutes: number = 5) => {
        if (!isConnected || isHistoryLoaded) return;
        requestedHistoryClusterIdRef.current = useClusterStore.getState().selectedClusterId;
        requestClusterHistory(minutes).catch(console.warn);
    }, [isConnected, isHistoryLoaded]);

    return {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isConnected,
        isHistoryLoaded,
        history,
        requestHistory: handleRequestHistory
    };
};

export default useClusterMetrics;
