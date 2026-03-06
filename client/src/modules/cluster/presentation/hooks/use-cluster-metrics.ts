import { useMemo, useCallback, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useSocketEvent from '@/modules/socket/presentation/hooks/use-socket-event';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { useClusterStore } from '../stores/use-cluster-store';
import { SOCKET_EVENTS } from '@/modules/cluster/domain/constants';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';

const useClusterMetrics = () => {
    const socketService = useSocket();
    const {
        clusters,
        selectedClusterId,
        isConnected,
        isHistoryLoaded,
        history,
        setClusters,
        setSelectedClusterId,
        setConnected,
        setHistory,
        resetHistory
    } = useClusterStore(useShallow((state) => ({
        clusters: state.clusters,
        selectedClusterId: state.selectedClusterId,
        isConnected: state.isConnected,
        isHistoryLoaded: state.isHistoryLoaded,
        history: state.history,
        setClusters: state.setClusters,
        setSelectedClusterId: state.setSelectedClusterId,
        setConnected: state.setConnected,
        setHistory: state.setHistory,
        resetHistory: state.resetHistory
    })));

    useEffect(() => {
        resetHistory();
    }, [resetHistory]);

    useEffect(() => {
        const handleConnectionChange = (connected: boolean) => {
            setConnected(connected);

            if (!connected) {
                resetHistory();
            }
        };

        const unsubscribe = socketService.onConnectionChange(handleConnectionChange);
        handleConnectionChange(socketService.isConnected());
        return unsubscribe;
    }, [resetHistory, setConnected, socketService]);

    useSocketEvent<ClusterMetrics[]>(
        SOCKET_EVENTS.metricsAll,
        setClusters
    );

    useSocketEvent<ClusterMetrics[]>(
        SOCKET_EVENTS.metricsHistory,
        setHistory
    );

    const metrics = useMemo(() => {
        if(!clusters.length) return null;
        return clusters.find((c) => c.clusterId === selectedClusterId) || null;
    }, [clusters, selectedClusterId]);

    const requestHistory = useCallback((minutes: number = 5) => {
        if(!isConnected || isHistoryLoaded) return;
        socketService.emit(SOCKET_EVENTS.metricsHistory, minutes).catch(console.warn);
    }, [isConnected, isHistoryLoaded, socketService]);

    return {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isConnected,
        isHistoryLoaded,
        history,
        requestHistory
    };
};

export default useClusterMetrics;
