import { Server, Socket } from 'socket.io';
import BaseSocketModule from '@/socket/base-socket-module';
import MetricsCollector from '@/services/metrics-collector';
import logger from '@/logger';

export default class MetricsModule extends BaseSocketModule{
    private collector?: MetricsCollector;
    private broadcastInterval?: NodeJS.Timeout;

    constructor(){
        super('metrics');
        this.collector = new MetricsCollector();
    }

    onInit(io: Server): void{
        // Only broadcast metrics to connected clients every second from Redis
        // NOTE: Collection happens in server.ts background process
        this.broadcastInterval = setInterval(async () => {
            try{
                // Get latest metrics from Redis for real-time updates
                const metrics = await this.collector?.getLatestFromRedis();
                if(metrics){
                    io.to('metrics-room').emit('metrics:update', metrics);
                }
            }catch(error: any){
                logger.error(`[Metrics Module] Broadcast error: ${error}`);
            }
        }, 1000);
    }

    onConnection(socket: Socket): void{
        logger.info(`[Metrics Module] Client ${socket.id} connected`);
        
        socket.join('metrics-room');
        this.sendInitialMetrics(socket);

        // Handle requests for historical data
        socket.on('metrics:history', async (minutes: number = 15) => {
            try{
                // Convert minutes to hours compatibility with existing methods
                const hours = minutes / 60;
                const history = await this.collector?.getMetricsFromRedis(hours);
                
                socket.emit('metrics:history', history || []);
            }catch(error: any){
                logger.error(`[Metrics Module] Error fetching history: ${error}`);
                socket.emit('metrics:error', { message: 'Failed to fetch historical data' });
            }
        });

        // Handle client disconnect
        socket.on('disconnect', () => {
            logger.info(`[Metrics Module] Client ${socket.id} disconnected`);
        });
    }

    private async sendInitialMetrics(socket: Socket){
        try{
            const latest = await this.collector?.getLatestFromRedis();
            if(latest){
                socket.emit('metrics:initial', latest);
            }
        }catch(error){
            logger.error(`[Metrics Module] Error sending initial metrics: ${error}`);
        }
    }

    async onShutdown(): Promise<void>{
        logger.info('[Metrics Module] Shutting down...');

        if(this.broadcastInterval){
            clearInterval(this.broadcastInterval);
        }
    }
};