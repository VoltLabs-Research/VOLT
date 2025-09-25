import http from 'http';
import Redis from 'ioredis';
import BaseSocketModule from '@/socket/base-socket-module';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from '@/config/redis';

/**
 * Central gateway that:
 * - Creates and holds the SocketIO server instance.
 * - Attaches the Redis adapter for multi-node setups.
 * - Registers feature modules and forwards connection events to them.
 */
class SocketGateway{
    private io?: Server;
    private adapterPub?: Redis;
    private adapterSub?: Redis;
    private initialized = false;
    private modules: BaseSocketModule[] = [];

    constructor(
        private corsOrigins: string[] = [
        process.env.CLIENT_DEV_HOST as string,
        process.env.CLIENT_HOST as string,
        ],
        private pingTimeout = 60_000,
        private pingInterval = 25_000
    ){}

    /**
     * Register a feature module (before initialize()).
     */
    register(module: BaseSocketModule): this{
        this.modules.push(module);
        return this;
    }

    /**
     * Initialize Socket.IO on top of the HTTP server and set up Redis adapter.
     */
    async initialize(server: http.Server): Promise<Server>{
        if(this.initialized && this.io) return this.io;

        this.io = new Server(server, {
            cors: {
                origin: this.corsOrigins.filter(Boolean),
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling'],
            pingTimeout: this.pingTimeout,
            pingInterval: this.pingInterval
        });

        this.adapterPub = createRedisClient();
        this.adapterSub = createRedisClient();
        this.io.adapter(createAdapter(this.adapterPub, this.adapterSub));

        for(const module of this.modules){
            module.onInit(this.io);
        }

        this.io.on('connection', (socket: Socket) => {
            console.log(`[Socket Gateway] Connected ${socket.id}`);
            for(const module of this.modules){
                module.onConnection(socket);
            }
        });

        this.initialized = true;
        return this.io;
    }

    /**
     * Graceful shutdown: close io, adapter redis, and notify modules.
     */
    async close(): Promise<void>{
        try{
            await Promise.all(this.modules.map((module) => module.onShutdown()));
        }catch(err: any){
            console.error('[Socket Gateway] Module shutdown error', err);
        }

        try{
            await new Promise<void>((res) => {
                if(this.io){
                    this.io.close(() => res());
                }else{
                    res();
                }
            });
        }catch{}

        try{
            await this.adapterPub?.quit();
        }catch{}

        try{
            await this.adapterSub?.quit();
        }catch{}

        this.io = undefined;
        this.adapterPub = undefined;
        this.adapterSub = undefined;
        this.initialized = false;
    }

    /**
     * Return the initialized SocketIO server.
     */
    getIO(): Server{
        if(!this.io){
            throw new Error('SocketIO not initialized');
        }

        return this.io;
    }
}

export default SocketGateway;
