import { useMemo, useCallback, useEffect } from 'react';
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
        setHistory
    } = useClusterStore();

    useEffect(() => {
        const unsubscribe = socketService.onConnectionChange(setConnected);
        setConnected(socketService.isConnected());
        return unsubscribe;
    }, [socketService, setConnected]);

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
        socketService.emit(SOCKET_EVENTS.metricsHistory, minutes).catch(() => {});
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
