import http from 'http';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from '@core/config/redis';
import { inject, injectable } from 'tsyringe';
import { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import { ISocketModule } from '@modules/socket/domain/port/ISocketModule';
import AuthenticateSocketConnectionUseCase from '@modules/socket/application/use-cases/AuthenticateSocketConnectionUseCase';
import type { ISocketConnectionData } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketConnectionMapper } from '@modules/socket/infrastructure/contracts/ISocketConnectionMapper';
import type { ISocketEmitterRuntime } from '@modules/socket/infrastructure/contracts/ISocketEmitterRuntime';
import type { ISocketEventRegistryRuntime } from '@modules/socket/infrastructure/contracts/ISocketEventRegistryRuntime';
import type { ISocketRoomManagerRuntime } from '@modules/socket/infrastructure/contracts/ISocketRoomManagerRuntime';

const SOCKET_CORS_ORIGINS = [
    process.env.CLIENT_DEV_HOST,
    process.env.CLIENT_HOST
].filter((origin): origin is string => Boolean(origin));

export interface AuthenticatedSocket extends Socket{
    user?: Awaited<ReturnType<AuthenticateSocketConnectionUseCase['execute']>>;
};

/**
 * Central gateway that creates and holds the Socket.IO server instance.
 * Attaches Redis adapter for multi-node setups and registers feature modules.
 */
@injectable()
export default class SocketGateway{
    private io?: Server;
    private adapterPub?: Redis;
    private adapterSub?: Redis;
    private initialized = false;
    private modules: ISocketModule[] = [];

    private corsOrigins = SOCKET_CORS_ORIGINS;

    private pingTimeout = 60_000;
    private pingInterval = 25_000;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private socketEmitter: ISocketEmitter,

        @inject(SOCKET_TOKENS.SocketRoomManager)
        private socketRoomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        private socketEventRegistry: ISocketEventRegistry,

        @inject(SOCKET_TOKENS.AuthenticateSocketConnectionUseCase)
        private authenticateSocketConnectionUseCase: AuthenticateSocketConnectionUseCase,

        @inject(SOCKET_TOKENS.SocketConnectionMapper)
        private socketMapper: ISocketConnectionMapper
    ){}

    static inject = [
        SOCKET_TOKENS.SocketEventEmitter,
        SOCKET_TOKENS.SocketRoomManager,
        SOCKET_TOKENS.SocketEventRegistry,
        SOCKET_TOKENS.AuthenticateSocketConnectionUseCase,
        SOCKET_TOKENS.SocketConnectionMapper
    ];

    /**
     * Register a feature module (before initialize()).
     */
    register(module: ISocketModule): this{
        this.modules.push(module);
        return this;
    }

    /**
     * Initialize Socket.IO on top of the HTTP server.
     */
    async initialize(server: http.Server): Promise<Server>{
        if(this.initialized && this.io) return this.io;

        for(const module of this.modules){
            await module.onInit();
        }

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

        this.io.adapter(createAdapter(this.adapterPub, this.adapterSub, {
            requestsTimeout: 10000
        }));

        this.getSocketEmitterRuntime().setServer(this.io);
        this.getSocketRoomManagerRuntime().setServer(this.io);

        // JWT authentication middleware
        this.io.use(async (socket, next) => {
            await this.authenticateSocket(socket, next);
        });

        // Registered synchronously after new Server() - no await in between,
        // so no event-loop yield where a 'connection' event could be lost.
        this.io.on('connection', (socket: Socket) => {
            this.handleConnection(socket);
        });

        this.initialized = true;
        return this.io;
    }

    /**
     * Handle new socket connection.
     */
    private handleConnection(socket: Socket): void{
        logger.info(`@socket-gateway - connected: ${socket.id}`);

        socket.data = (socket.data ?? {}) as ISocketConnectionData;

        this.getSocketEmitterRuntime().registerConnection(socket);
        this.getSocketRoomManagerRuntime().registerConnection(socket);
        this.getSocketEventRegistryRuntime().registerConnection(socket);

        const connection = this.socketMapper.toDomain(socket);

        // Notify all modules
        for(const module of this.modules){
            module.onConnection(connection);
        }

        // Disconnect cleanup
        socket.on('disconnect', () => {
            this.getSocketEmitterRuntime().unregisterConnection(socket.id);
            this.getSocketRoomManagerRuntime().unregisterConnection(socket.id);
            this.getSocketEventRegistryRuntime().unregisterConnection(socket.id);
            logger.info(`@socket-gateway - disconnected ${socket.id}`);
        });
    }

    /**
     * Graceful shutdown.
     */
    async close(): Promise<void>{
        try{
            await Promise.all(this.modules.map((module) => module.onShutdown()));
        }catch(error: unknown){
            logger.error(`@socket-gateway - module shutdown error: ${error}`);
        }

        try{
            await new Promise<void>((res) => {
                if(this.io){
                    this.io.close(() => res());
                }else{
                    res();
                }
            })
        }catch{
        }

        try{
            await this.adapterPub?.quit();
        }catch(error){
            logger.warn(error, '@socket-gateway - failed to quit Redis pub client');
        }

        try{
            await this.adapterSub?.quit();
        }catch(error){
            logger.warn(error, '@socket-gateway - failed to quit Redis sub client');
        }

        this.io = undefined;
        this.adapterPub = undefined;
        this.adapterSub = undefined;
        this.initialized = false;
    }

    /**
     * Returns the initialized Socket.IO server.
     */
    getIO(): Server{
        if(!this.io){
            throw new Error('SocketIO not initialized');
        }
        return this.io;
    }

    /**
     * Handle socket authentication.
     */
    private async authenticateSocket(
        socket: AuthenticatedSocket,
        next: (error?: Error) => void
    ): Promise<void>{
        try{
            const token = socket.handshake.auth?.token;
            if(!token){
                socket.user = null;
                logger.info(`@socket-gateway - anonymous user connected: ${socket.id}`);
                return next();
            }

            const user = await this.authenticateSocketConnectionUseCase.execute(token);
            if(!user){
                socket.user = null;
                logger.info(`@socket-gateway - user not found, allowing anonymous: ${socket.id}`);
                return next();
            }

            socket.user = user;

            logger.info(`@socket-gateway - authenticated user connected: ${user.firstName} ${user.lastName} (${socket.id})`);
            next();
        }catch(error){
            socket.user = null;
            next();
        }
    }

    private getSocketEmitterRuntime(): ISocketEmitterRuntime {
        return this.socketEmitter as ISocketEmitterRuntime;
    }

    private getSocketRoomManagerRuntime(): ISocketRoomManagerRuntime {
        return this.socketRoomManager as ISocketRoomManagerRuntime;
    }

    private getSocketEventRegistryRuntime(): ISocketEventRegistryRuntime {
        return this.socketEventRegistry as ISocketEventRegistryRuntime;
    }
};
