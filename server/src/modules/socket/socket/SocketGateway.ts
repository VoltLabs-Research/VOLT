import { createRedisClient } from '@core/config/redis';
import { ErrorCodes } from '@core/constants/error-codes';
import AuthenticateSocketConnectionUseCase from '@modules/socket/application/use-cases/AuthenticateSocketConnectionUseCase';
import type { ISocketAuthenticationResult, ISocketConnectionData, ISocketConnectionUser } from '@modules/socket/domain/port/ISocketModule';
import { ISocketModule } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketEmitterRuntime } from '@modules/socket/infrastructure/contracts/ISocketEmitterRuntime';
import type { ISocketEventRegistryRuntime } from '@modules/socket/infrastructure/contracts/ISocketEventRegistryRuntime';
import type { ISocketRoomManagerRuntime } from '@modules/socket/infrastructure/contracts/ISocketRoomManagerRuntime';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import SocketConnectionMapper from '@modules/socket/utilities/SocketConnectionMapper';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { TRACE_ID_HEADER } from '@shared/infrastructure/http/middleware/request-context';
import logger from '@shared/infrastructure/logger';
import { collectAllowedClientOrigins } from '@shared/infrastructure/utilities/client-origins';
import { createAdapter } from '@socket.io/redis-adapter';
import http from 'http';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { Server, Socket } from 'socket.io';

interface SocketConnectionRuntimeData extends ISocketConnectionData {
    traceId?: string;
    connectedAt?: number;
    authenticatedAt?: number;
    authDurationMs?: number;
    authState?: ISocketAuthenticationResult['state'];
    authReason?: ISocketAuthenticationResult['reason'];
}

const SOCKET_CORS_ORIGINS = collectAllowedClientOrigins([
    process.env.CLIENT_DEV_HOST,
    process.env.CLIENT_HOST
]);
const SOCKET_GATEWAY_CLOSE_TIMEOUT_MS = 1_500;

interface AuthenticatedSocket extends Socket{
    user?: ISocketConnectionUser | null;
}

/**
 * Central gateway that creates and holds the Socket.IO server instance.
 * Attaches Redis adapter for multi-node setups and registers feature modules.
 */
@Singleton()
export default class SocketGateway{
    private io?: Server;
    private adapterPub?: Redis;
    private adapterSub?: Redis;
    private initialized = false;
    private modules: ISocketModule[] = [];

    private corsOrigins = SOCKET_CORS_ORIGINS;

    private pingTimeout = 20_000;
    private pingInterval = 10_000;

    constructor(
        private socketEmitter: SocketIOEmitter,
        private socketRoomManager: SocketIORoomManager,
        private socketEventRegistry: SocketIOEventRegistry,
        private authenticateSocketConnectionUseCase: AuthenticateSocketConnectionUseCase,
        private socketMapper: SocketConnectionMapper
    ){}

    static inject = [
        SocketIOEmitter,
        SocketIORoomManager,
        SocketIOEventRegistry,
        AuthenticateSocketConnectionUseCase,
        SocketConnectionMapper
    ];

    /**
     * Register a feature module (before initialize()).
     */
    register(module: ISocketModule): this{
        this.modules.push(module);
        return this;
    }

    async initialize(server: http.Server): Promise<Server>{
        if(this.initialized && this.io) return this.io;

        for(const module of this.modules){
            await module.onInit();
        }

        this.io = new Server(server, {
            cors: {
                origin: true,
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling'],
            pingTimeout: this.pingTimeout,
            pingInterval: this.pingInterval,
            // Why: payloads on the client↔server channel include large
            // structured JSON (trajectory atoms pages, filter metadata).
            // `perMessageDeflate` trims 40–80 % of the gzip-friendly text
            // portion; binary attachments passthrough uncompressed.
            // Safe in Socket.IO v4 — opt-in per server.
            perMessageDeflate: {
                threshold: 1024,
                zlibDeflateOptions: { chunkSize: 16 * 1024 },
                zlibInflateOptions: { chunkSize: 16 * 1024 }
            },
            // Raised from 10 MB because binary attachments now travel without
            // base64 inflation (≈ 1.33× reduction) but we also carry masks
            // and property columns for multi-million atom trajectories.
            maxHttpBufferSize: 512 * 1024 * 1024
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

    private handleConnection(socket: Socket): void{
        const socketData = this.getSocketConnectionData(socket);

        logger.info(`@socket-gateway - connected socketId=${socket.id} traceId=${socketData.traceId} userId=${socketData.auth?.user?._id}`);

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
            logger.info(`@socket-gateway - disconnected socketId=${socket.id} traceId=${socketData.traceId}`);
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
                            logger.warn(`@socket-gateway - socket shutdown timed out, continuing timeoutMs=${SOCKET_GATEWAY_CLOSE_TIMEOUT_MS}`);
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

    getIO(): Server{
        if(!this.io){
            throw new Error('SocketIO not initialized');
        }
        return this.io;
    }

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
                logger.info(`@socket-auth outcome=${'guest'} socketId=${socket.id} traceId=${socketData.traceId} durationMs=${socketData.authDurationMs}`);
                return next();
            }

            if(auth.state === 'rejected' || !auth.user){
                socket.user = null;
                logger.warn(`@socket-auth outcome=${'rejected'} reason=${auth.reason} socketId=${socket.id} traceId=${socketData.traceId}`);
                return next(this.createSocketAuthenticationError(auth));
            }

            socket.user = auth.user;

            logger.info(`@socket-auth outcome=${'authenticated'} socketId=${socket.id} userId=${auth.user._id} traceId=${socketData.traceId}`);
            next();
        }catch(error){
            socket.user = null;
            logger.error(`@socket-auth socketId=${socket.id} traceId=${this.getSocketConnectionData(socket).traceId}`);
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
}
