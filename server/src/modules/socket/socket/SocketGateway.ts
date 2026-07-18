import { createRedisClient } from '@core/config/redis';
import { ErrorCodes } from '@core/constants/error-codes';
import UserModel from '@modules/auth/models/UserModel';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import SessionModel from '@modules/session/models/SessionModel';
import type { ISocketAuthenticationResult, ISocketConnectionData, ISocketConnectionUser } from '@modules/socket/ports/ISocketModule';
import { ISocketModule } from '@modules/socket/ports/ISocketModule';
import SocketIOEmitter, { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import SocketIOEventRegistry, { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import SocketIORoomManager, { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import socketConnectionMapper from '@modules/socket/utilities/SocketConnectionMapper';
import { TRACE_ID_HEADER } from '@shared/infrastructure/http/middleware/request-context';
import logger from '@shared/infrastructure/logger';
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

const SOCKET_GATEWAY_CLOSE_TIMEOUT_MS = 1_500;

interface AuthenticatedSocket extends Socket{
    user?: ISocketConnectionUser | null;
}

export class SocketGateway{
    private io?: Server;
    private adapterPub?: Redis;
    private adapterSub?: Redis;
    private initialized = false;
    private modules: ISocketModule[] = [];

    private pingTimeout = 20_000;
    private pingInterval = 10_000;

    #tokenService = new JwtTokenService();

    constructor(
        private socketEmitter: SocketIOEmitter,
        private socketRoomManager: SocketIORoomManager,
        private socketEventRegistry: SocketIOEventRegistry
    ){}

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
            perMessageDeflate: {
                threshold: 1024,
                zlibDeflateOptions: { chunkSize: 16 * 1024 },
                zlibInflateOptions: { chunkSize: 16 * 1024 }
            },
            maxHttpBufferSize: 512 * 1024 * 1024
        });

        this.adapterPub = createRedisClient();
        this.adapterSub = createRedisClient();

        this.io.adapter(createAdapter(this.adapterPub, this.adapterSub, {
            requestsTimeout: 10000
        }));

        this.socketEmitter.setServer(this.io);
        this.socketRoomManager.setServer(this.io);

        this.io.use(async (socket, next) => {
            await this.authenticateSocket(socket, next);
        });

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

        this.socketEmitter.registerConnection(socket);
        this.socketRoomManager.registerConnection(socket);
        this.socketEventRegistry.registerConnection(socket);

        const connection = socketConnectionMapper.toDomain(socket);

        for(const module of this.modules){
            module.onConnection(connection);
        }

        this.socketEventRegistry.onDisconnect(socket.id, () => {
            this.socketEmitter.unregisterConnection(socket.id);
            this.socketRoomManager.unregisterConnection(socket.id);
            this.socketEventRegistry.unregisterConnection(socket.id);
            logger.info(`@socket-gateway - disconnected socketId=${socket.id} traceId=${socketData.traceId}`);
        });
    }

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

    private async authenticateSocketConnection(token?: string): Promise<ISocketAuthenticationResult> {
        if (!token) {
            return {
                state: 'guest',
                reason: 'missing_token'
            };
        }

        const decoded = this.#tokenService.verify(token);
        if (!decoded?.id) {
            return {
                state: 'rejected',
                reason: 'invalid_token'
            };
        }

        const user = await UserModel.findById(decoded.id);

        if (!user) {
            return {
                state: 'rejected',
                reason: 'user_not_found'
            };
        }

        if (user.isPasswordChangedAfterTokenIssued(decoded.iat ?? 0)) {
            return {
                state: 'rejected',
                reason: 'password_changed'
            };
        }

        const session = await SessionModel.findOne({ token, isActive: true });
        if (!session) {
            return {
                state: 'rejected',
                reason: 'invalid_token'
            };
        }

        const socketUser: ISocketConnectionUser = {
            _id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            avatar: user.avatar,
            teams: user.teams.map((teamId) => teamId.toString()),
            role: user.role
        };

        return {
            state: 'authenticated',
            user: socketUser
        };
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

            const auth = await this.authenticateSocketConnection(token);

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
}

const socketGateway = new SocketGateway(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);

export default socketGateway;
