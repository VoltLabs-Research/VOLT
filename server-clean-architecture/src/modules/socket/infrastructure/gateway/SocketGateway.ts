import http from 'http';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from '@/src/core/config/redis';
import { inject, injectable } from 'tsyringe';
import { ISocketEmitter } from '../../domain/ports/ISocketEmitter';
import { ISocketRoomManager } from '../../domain/ports/ISocketRoomManager';
import { ISocketEventRegistry } from '../../domain/ports/ISocketEventRegistry';
import { SOCKET_TOKENS } from '../di/SocketTokens';
import { IUserRepository } from '@/src/modules/auth/domain/ports/IUserRepository';
import logger from '@/src/shared/infrastructure/logger';
import { ISocketModule } from '../../domain/ports/ISocketModule';
import { AUTH_TOKENS } from '@/src/modules/auth/infrastructure/di/AuthTokens';
import JwtTokenService from '@/src/modules/auth/infrastructure/security/JwtTokenService';
import { ISocketMapper } from '../../domain/ports/ISocketMapper';

export interface AuthenticatedSocket extends Socket{
    user?: any;
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

    private corsOrigins: string[] = [
        process.env.CLIENT_DEV_HOST as string,
        process.env.CLIENT_HOST as string
    ];

    private pingTimeout = 60_000;
    private pingInterval = 25_000;

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private socketEmitter: ISocketEmitter,

        @inject(SOCKET_TOKENS.SocketRoomManager)
        private socketRoomManager: ISocketRoomManager,

        @inject(SOCKET_TOKENS.SocketEventRegistry)
        private socketEventRegistry: ISocketEventRegistry,

        @inject(AUTH_TOKENS.UserRepository)
        private userRepository: IUserRepository,

        @inject(AUTH_TOKENS.JwtTokenService)
        private jwtTokenService: JwtTokenService,

        @inject(SOCKET_TOKENS.SocketMapper)
        private socketMapper: ISocketMapper
    ){}

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

        this.socketEmitter.setServer(this.io);
        this.socketRoomManager.setServer(this.io);

        // JWT authentication middleware
        this.io.use(async (socket, next) => {
            await this.authenticateSocket(socket, next);
        });

        // Initialize all modules
        for(const module of this.modules){
            await module.onInit();
        }

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

        this.socketEmitter.registerSocket(socket);
        this.socketRoomManager.registerSocket(socket);
        this.socketEventRegistry.registerSocket(socket);

        const connection = this.socketMapper.toDomain(socket);

        // Notify all modules
        for(const module of this.modules){
            module.onConnection(connection);
        }

        // Disconnect cleanup
        socket.on('disconnect', () => {
            this.socketEmitter.unregisterSocket(socket.id);
            this.socketRoomManager.unregisterSocket(socket.id);
            this.socketEventRegistry.unregisterSocket(socket.id);
            logger.info(`@socket-gateway - disconnected ${socket.id}`);
        });
    }

    /**
     * Graceful shutdown.
     */
    async close(): Promise<void>{
        // TODO: add a function for avoid try-catch
        try{
            await Promise.all(this.modules.map((module) => module.onShutdown()));
        }catch(error: any){
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
            
            const decoded = this.jwtTokenService.verify(token);
            const user = await this.userRepository.findById(decoded?.id || '');
            if(!user){
                socket.user = null;
                logger.info(`@socket-gateway - user not found, allowing anonymous: ${socket.id}`);
                return next();
            }

            // Convert domain entity to socket user formt
            socket.user = {
                _id: user.id,
                firstName: user.props.firstName,
                lastName: user.props.lastName,
                email: user.props.email,
                avatar: user.props.avatar,
                teams: user.props.teams                
            };

            logger.info(`@socket-gateway - authenticated user connected: ${user.props.firstName} ${user.props.lastName} (${socket.id})`);
            next();
        }catch(error){
            socket.user = null;
            next();
        }
    }
};