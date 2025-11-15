import { Server, Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';
import MetricsCollector from '@/services/metrics-collector';

class MetricsModule extends BaseSocketModule {
  private collector: MetricsCollector;
  private broadcastInterval?: NodeJS.Timeout;

  constructor() {
    super('metrics');
    this.collector = new MetricsCollector('backend-01');
  }

  onInit(io: Server): void {
    console.log('[Metrics Module] Initializing...');
    
    // Only broadcast metrics to connected clients every second from Redis
    // Note: Collection happens in server.ts background process
    this.broadcastInterval = setInterval(async () => {
      try {
        // Get latest metrics from Redis for real-time updates
        const metrics = await this.collector.getLatestFromRedis();
        if (metrics) {
          io.to('metrics-room').emit('metrics:update', metrics);
        }
      } catch (error) {
        console.error('[Metrics Module] Broadcast error:', error);
      }
    }, 1000);

    console.log('[Metrics Module] Started broadcasting metrics to connected clients');
  }

  onConnection(socket: Socket): void {
    console.log(`[Metrics Module] Client ${socket.id} connected`);

    // Join metrics room
    socket.join('metrics-room');

    // Send initial metrics
    this.sendInitialMetrics(socket);

    // Handle requests for historical data (from Redis first, fallback to MongoDB)
    socket.on('metrics:history', async (minutes: number = 15) => {
      try {
        // Convert minutes to hours for compatibility with existing methods
        const hours = minutes / 60;
        // Try to get from Redis first for faster access
        let history = await this.collector.getMetricsFromRedis(hours);
        
        // If Redis is empty or has no data, fallback to MongoDB
        if (!history || history.length === 0) {
          history = await this.collector.getHistory(hours);
        }
        
        socket.emit('metrics:history', history);
      } catch (error) {
        console.error('[Metrics Module] Error fetching history:', error);
        socket.emit('metrics:error', { message: 'Failed to fetch historical data' });
      }
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log(`[Metrics Module] Client ${socket.id} disconnected`);
    });
  }

  private async sendInitialMetrics(socket: Socket) {
    try {
      // Try to get from Redis first for faster access
      let latest = await this.collector.getLatestFromRedis();
      
      // If Redis is empty, fallback to MongoDB
      if (!latest) {
        latest = await this.collector.getLatest();
      }
      
      if (latest) {
        socket.emit('metrics:initial', latest);
      }
    } catch (error) {
      console.error('[Metrics Module] Error sending initial metrics:', error);
    }
  }

  async onShutdown(): Promise<void> {
    console.log('[Metrics Module] Shutting down...');
    
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
  }
}

export default MetricsModule;
