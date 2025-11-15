import { useEffect, useState } from 'react';
import { socketService } from '@/services/socketio';


export function useServerMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [history, setHistory] = useState([]);
  const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);

  useEffect(() => {
    // Subscribe to connection changes
    const unsubscribeConnection = socketService.onConnectionChange((connected) => {
      console.log('[Metrics] Connection status:', connected);
      setIsConnected(connected);
      
      // Request historical data when connected (15 minutes by default)
      if (connected && !isHistoryLoaded) {
        console.log('[Metrics] Requesting historical data...');
        socketService.emit('metrics:history', 15).catch((error) => {
          console.error('[Metrics] Error requesting history:', error);
        });
      }
    });

    // Subscribe to metrics events
    const unsubscribeInitial = socketService.on('metrics:initial', (data) => {
      setMetrics(data);
    });

    const unsubscribeUpdate = socketService.on('metrics:update', (data) => {
      setMetrics(data);
    });

    const unsubscribeError = socketService.on<any>('metrics:error', (error) => {
      console.error('[Metrics] Error:', error);
    });

    const unsubscribeHistory = socketService.on('metrics:history', (data) => {
      setHistory(data);
      setIsHistoryLoaded(true);
    });

    // Request historical data on mount if connected (15 minutes by default)
    if (socketService.isConnected() && !isHistoryLoaded) {
      console.log('[Metrics] Initial history request...');
      socketService.emit('metrics:history', 15).catch((error) => {
        console.error('[Metrics] Error requesting initial history:', error);
      });
    }

    // Cleanup subscriptions
    return () => {
      unsubscribeConnection();
      unsubscribeInitial();
      unsubscribeUpdate();
      unsubscribeError();
      unsubscribeHistory();
    };
  }, [isHistoryLoaded]);

  const requestHistory = (minutes: number = 15) => {
    socketService.emit('metrics:history', minutes).catch((error) => {
      console.error('[Metrics] Error requesting history:', error);
    });
  };

  return {
    metrics,
    isConnected,
    history,
    isHistoryLoaded,
    requestHistory
  };
}
