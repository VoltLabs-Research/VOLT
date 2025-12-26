import { useEffect, useState } from 'react';
import { socketService } from '@/services/socketio';
import useLogger from '@/hooks/core/use-logger';

export const useServerMetrics = () => {
    const [metrics, setMetrics] = useState(null);
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

        // Subscribe to metrics event
        const unsubscribeInitial = socketService.on('metrics:initial', (data) => {
            setMetrics(data);
        });

        const unsubscribeUpdate = socketService.on('metrics:update', (data) => {
            setMetrics(data);
        });

        const unsubscribeAll = socketService.on('metrics:all', (data) => {
            setClusters(data);
            // Auto-update selected metrics if it matches
            const selected = data.find((c: any) => c.clusterId === selectedClusterId);
            if (selected) setMetrics(selected);
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
            unsubscribeInitial();
            unsubscribeUpdate();
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
