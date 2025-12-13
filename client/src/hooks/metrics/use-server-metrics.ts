import { useEffect, useState } from 'react';
import { socketService } from '@/services/socketio';
import useLogger from '@/hooks/core/use-logger';

export const useServerMetrics = () => {
    const [metrics, setMetrics] = useState(null);
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

        const unsubscribeError = socketService.on('metrics:error', (error) => {
            logger.log(error);
        });

        const unsubscribeHistory = socketService.on('metrics:history', (data) => {
            setHistory(data);
            setIsHistoryLoaded(true);
        });

        return() => {
            unsubscribeConnection();
            unsubscribeInitial();
            unsubscribeUpdate();
            unsubscribeError();
            unsubscribeHistory();
        };
    }, [isHistoryLoaded]);

    useEffect(() => {
        if(!isConnected || isHistoryLoaded) return;

        logger.log('requesting historical data...');
        socketService.emit('metrics:history', 15).catch((error) => {
            logger.log('error requesting history:', error);
        });
    }, [isConnected, isHistoryLoaded]);

    return { metrics, isConnected, history, isHistoryLoaded };
};
