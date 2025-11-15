import { useEffect, useState } from 'react';
import { socketService } from '@/services/socketio';

interface ServerMetrics {
  timestamp: Date;
  serverId: string;
  cpu: {
    usage: number;
    cores: number;
    loadAvg: number[];
    coresUsage?: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    incoming: number;
    outgoing: number;
    total: number;
  };
  responseTime: number;
  responseTimes?: {
    mongodb: number;
    redis: number;
    self: number;
    average: number;
  };
  diskOperations?: {
    read: number;
    write: number;
    speed: number;
  };
  status: 'Healthy' | 'Warning' | 'Critical';
  uptime: number;
  mongodb?: {
    connections: number;
    queries: number;
    latency: number;
  };
  drives: {
    name: string;
    capacity: number;
    used: number;
    type: string;
  }[];
}

export function useServerMetrics() {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  const [history, setHistory] = useState<ServerMetrics[]>([]);
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
    const unsubscribeInitial = socketService.on<ServerMetrics>('metrics:initial', (data) => {
      console.log('[Metrics] Initial data received');
      console.log(data);
      setMetrics(data);
    });

    const unsubscribeUpdate = socketService.on<ServerMetrics>('metrics:update', (data) => {
      console.log(data);
      setMetrics(data);
    });

    const unsubscribeError = socketService.on<any>('metrics:error', (error) => {
      console.error('[Metrics] Error:', error);
    });

    const unsubscribeHistory = socketService.on<ServerMetrics[]>('metrics:history', (data) => {
      console.log('[Metrics] Historical data received:', data.length, 'points');
      console.log(data);
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
