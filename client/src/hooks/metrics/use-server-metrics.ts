import { useEffect, useState, useMemo } from 'react';
import { socketService } from '@/services/websockets/socketio';
import useLogger from '@/hooks/core/use-logger';

export const useServerMetrics = () => {
    // const [metrics, setMetrics] = useState(null); // Derived now
    const [clusters, setClusters] = useState<any[]>([]); // New state for all clusters
    const [selectedClusterId, setSelectedClusterId] = useState<string>('main-cluster');
    const [isConnected, setIsConnected] = useState(socketService.isConnected());
    const [history, setHistory] = useState([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const logger = useLogger('use-server-metrics');

    useEffect(() => {
        // Subscribe to connection changes
        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            logger.log('connection status:', connected);
            setIsConnected(connected);
        });

        // Disable single-update listeners to rely on metrics:all for consistency in multi-cluster view
        // const unsubscribeInitial = socketService.on('metrics:initial', (data) => {
        //     setMetrics(data);
        // });

        // const unsubscribeUpdate = socketService.on('metrics:update', (data) => {
        //     setMetrics(data);
        // });

        const unsubscribeAll = socketService.on('metrics:all', (data) => {
            setClusters(data);
        });

        const unsubscribeError = socketService.on('metrics:error', (error) => {
            logger.log(error);
        });

        const unsubscribeHistory = socketService.on('metrics:history', (data) => {
            setHistory(data);
            setIsHistoryLoaded(true);
        });

        return () => {
            unsubscribeConnection();
            // unsubscribeInitial();
            // unsubscribeUpdate();
            unsubscribeAll();
            unsubscribeError();
            unsubscribeHistory();
        };
    }, [isHistoryLoaded]);

    useEffect(() => {
        if (!isConnected || isHistoryLoaded) return;

        logger.log('requesting historical data...');
        socketService.emit('metrics:history', 15).catch((error) => {
            logger.log('error requesting history:', error);
        });
    }, [isConnected, isHistoryLoaded]);

    const metrics = useMemo(() => {
        if (!clusters.length) return null;
        return clusters.find(c => c.clusterId === selectedClusterId) || null;
    }, [clusters, selectedClusterId]);

    // Auto-select first cluster if none selected or current selection invalid
    useEffect(() => {
        if (clusters.length > 0) {
            const currentExists = clusters.some(c => c.clusterId === selectedClusterId);
            if (!currentExists || selectedClusterId === 'main-cluster') {
                setSelectedClusterId(clusters[0].clusterId);
            }
        }
    }, [clusters, selectedClusterId]);

    return {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isConnected,
        history,
        isHistoryLoaded
    };
};
