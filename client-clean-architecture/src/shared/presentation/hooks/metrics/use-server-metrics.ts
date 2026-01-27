import { useEffect, useState, useMemo } from 'react';
import { socketService } from '@/shared/infrastructure/services/SocketIOService';
import useLogger from '@/shared/presentation/hooks/core/use-logger';

export const useServerMetrics = () => {
    const [clusters, setClusters] = useState<any[]>([]);
    const [selectedClusterId, setSelectedClusterId] = useState<string>('main-cluster');
    const [isConnected, setIsConnected] = useState(socketService.isConnected());
    const [history, setHistory] = useState<any[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const logger = useLogger('use-server-metrics');

    useEffect(() => {
        const unsubscribeConnection = socketService.onConnectionChange((connected) => {
            logger.log('connection status:', connected);
            setIsConnected(connected);
        });

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
        return clusters.find((c) => c.clusterId === selectedClusterId) || null;
    }, [clusters, selectedClusterId]);

    useEffect(() => {
        if (clusters.length > 0) {
            const currentExists = clusters.some((c) => c.clusterId === selectedClusterId);
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
