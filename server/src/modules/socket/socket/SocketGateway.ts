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
import { TRACE_ID_HEADER } from '@shared/infrastructure/http/middleware/request-context';
import { collectAllowedClientOrigins } from '@shared/infrastructure/utilities/client-origins';
import type { ISocketAuthenticationResult, ISocketConnectionData, ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';
import { ErrorCodes } from '@core/constants/error-codes';
import { randomUUID } from 'node:crypto';
import type { ISocketConnectionMapper } from '@modules/socket/infrastructure/contracts/ISocketConnectionMapper';
import type { ISocketEmitterRuntime } from '@modules/socket/infrastructure/contracts/ISocketEmitterRuntime';
import type { ISocketEventRegistryRuntime } from '@modules/socket/infrastructure/contracts/ISocketEventRegistryRuntime';
import type { ISocketRoomManagerRuntime } from '@modules/socket/infrastructure/contracts/ISocketRoomManagerRuntime';

interface SocketConnectionRuntimeData extends ISocketConnectionData {
    traceId?: string;
    connectedAt?: number;
    authenticatedAt?: number;
    authDurationMs?: number;
    authState?: ISocketAuthenticationResult['state'];
    authReason?: ISocketAuthenticationResult['reason'];
};

const SOCKET_CORS_ORIGINS = collectAllowedClientOrigins([
    process.env.CLIENT_DEV_HOST,
    process.env.CLIENT_HOST
]);
const SOCKET_GATEWAY_CLOSE_TIMEOUT_MS = 1_500;

export interface AuthenticatedSocket extends Socket{
    user?: ISocketConnectionUser | null;
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
            pingInterval: this.pingInterval,
            maxHttpBufferSize: 10e6 // 10 MB — safety net for chunked uploads (~682 KB base64 per chunk)
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
        const socketData = this.getSocketConnectionData(socket);

        logger.info({
            socketId: socket.id,
            traceId: socketData.traceId,
            userId: socketData.auth?.user?._id
        }, '@socket-gateway - connected');

        socket.data = socketData;

        this.getSocketEmitterRuntime().registerConnection(socket);
        this.getSocketRoomManagerRuntime().registerConnection(socket);
        this.getSocketEventRegistryRuntime().registerConnection(socket);

        const connection = this.socketMapper.toDomain(socket);

        // Notify all modules
        for(const module of this.modules){
            module.onConnection(connection);
        }

        // Disconnect cleanup — routed through the event registry so only
        // one native `socket.on('disconnect')` listener exists per socket.
        this.socketEventRegistry.onDisconnect(socket.id, () => {
            this.getSocketEmitterRuntime().unregisterConnection(socket.id);
            this.getSocketRoomManagerRuntime().unregisterConnection(socket.id);
            this.getSocketEventRegistryRuntime().unregisterConnection(socket.id);
            logger.info({
                socketId: socket.id,
                traceId: socketData.traceId
            }, '@socket-gateway - disconnected');
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
            if (this.io) {
                this.io.disconnectSockets(true);
                let closeTimeout: NodeJS.Timeout | null = null;

                await Promise.race([
                    new Promise<void>((resolve) => {
                        this.io?.close(() => {
                            if (closeTimeout) {
                                clearTimeout(closeTimeout);
                            }

                            resolve();
                        });
                    }),
                    new Promise<void>((resolve) => {
                        closeTimeout = setTimeout(() => {
                            logger.warn({
                                timeoutMs: SOCKET_GATEWAY_CLOSE_TIMEOUT_MS
                            }, '@socket-gateway - socket shutdown timed out, continuing');
                            resolve();
                        }, SOCKET_GATEWAY_CLOSE_TIMEOUT_MS);

                        closeTimeout.unref();
                    })
                ]);
            }
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
            const socketData = this.getSocketConnectionData(socket);
            const startedAt = Date.now();
            const token = socket.handshake.auth?.token;
            socketData.traceId = this.resolveSocketTraceId(socket);
            socketData.connectedAt = socketData.connectedAt ?? startedAt;

            const auth = await this.authenticateSocketConnectionUseCase.execute(token);

            socketData.auth = auth;
            socketData.authenticatedAt = Date.now();
            socketData.authDurationMs = socketData.authenticatedAt - startedAt;
            socketData.authState = auth.state;
            socketData.authReason = auth.reason;

            if(auth.state === 'guest'){
                socket.user = null;
                logger.info({
                    outcome: 'guest',
                    socketId: socket.id,
                    traceId: socketData.traceId,
                    durationMs: socketData.authDurationMs
                }, '@socket-auth');
                return next();
            }

            if(auth.state === 'rejected' || !auth.user){
                socket.user = null;
                logger.warn({
                    outcome: 'rejected',
                    reason: auth.reason,
                    socketId: socket.id,
                    traceId: socketData.traceId,
                    durationMs: socketData.authDurationMs
                }, '@socket-auth');
                return next(this.createSocketAuthenticationError(auth));
            }

            socket.user = auth.user;

            logger.info({
                outcome: 'authenticated',
                socketId: socket.id,
                userId: auth.user._id,
                traceId: socketData.traceId,
                durationMs: socketData.authDurationMs
            }, '@socket-auth');
            next();
        }catch(error){
            socket.user = null;
            logger.error({
                err: error,
                socketId: socket.id,
                traceId: this.getSocketConnectionData(socket).traceId
            }, '@socket-auth');
            next(this.createSocketAuthenticationError({
                state: 'rejected',
                reason: 'invalid_token'
            }));
        }
    }

    private createSocketAuthenticationError(auth: ISocketAuthenticationResult): Error {
        const code = auth.reason === 'user_not_found'
            ? ErrorCodes.USER_NOT_FOUND
            : ErrorCodes.AUTHENTICATION_UNAUTHORIZED;
        const details = auth.reason === 'password_changed'
            ? 'Socket token is no longer valid after password change'
            : auth.reason === 'user_not_found'
                ? ErrorCodes.USER_NOT_FOUND
                : ErrorCodes.AUTHENTICATION_UNAUTHORIZED;
        const error = new Error(details) as Error & {
            data?: {
                code: string;
                reason?: ISocketAuthenticationResult['reason'];
            };
        };

        error.data = {
            code,
            reason: auth.reason
        };

        return error;
    }

    private getSocketEmitterRuntime(): ISocketEmitterRuntime {
        return this.socketEmitter as ISocketEmitterRuntime;
    }

    private getSocketConnectionData(socket: Socket): SocketConnectionRuntimeData {
        return socket.data as SocketConnectionRuntimeData;
    }

    private resolveSocketTraceId(socket: Socket): string {
        const headerTraceId = socket.handshake.headers[TRACE_ID_HEADER];

        if (Array.isArray(headerTraceId)) {
            const traceId = headerTraceId[0]?.trim();

            if (traceId) {
                return traceId;
            }
        }

        if (typeof headerTraceId === 'string' && headerTraceId.trim()) {
            return headerTraceId.trim();
        }

        const authTraceId = socket.handshake.auth?.traceId;

        if (typeof authTraceId === 'string' && authTraceId.trim()) {
            return authTraceId.trim();
        }

        return randomUUID();
    }

    private getSocketRoomManagerRuntime(): ISocketRoomManagerRuntime {
        return this.socketRoomManager as ISocketRoomManagerRuntime;
    }

    private getSocketEventRegistryRuntime(): ISocketEventRegistryRuntime {
        return this.socketEventRegistry as ISocketEventRegistryRuntime;
    }
};
