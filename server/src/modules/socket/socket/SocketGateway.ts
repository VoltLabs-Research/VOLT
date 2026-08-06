import { ErrorCodes } from '@core/constants/error-codes';
import User from '@modules/auth/models/User';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import Session from '@modules/session/models/Session';
import type {
    ISocketAuthenticationResult,
    ISocketConnectionData,
    ISocketConnectionUser,
    ISocketModule
} from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import { toSocketConnection } from '@modules/socket/socket/SocketConnectionMapper';
import { TRACE_ID_HEADER } from '@shared/infrastructure/http/middleware/request-context';
import logger from '@shared/infrastructure/logger';
import http from 'http';
import { randomUUID } from 'node:crypto';
import { Server, Socket } from 'socket.io';

interface SocketConnectionRuntimeData extends ISocketConnectionData {
    traceId?: string;
}

const SOCKET_GATEWAY_CLOSE_TIMEOUT_MS = 1_500;

interface AuthenticatedSocket extends Socket{
    user?: ISocketConnectionUser | null;
}

const resolveSocketTraceId = (socket: Socket): string => {
    const headerTraceId = socket.handshake.headers[TRACE_ID_HEADER];
    // socket.io types `handshake.auth` values as `any`.
    const authTraceId: unknown = socket.handshake.auth?.traceId;
    const traceId = (Array.isArray(headerTraceId) ? headerTraceId[0] : headerTraceId)
        ?? (typeof authTraceId === 'string' ? authTraceId : undefined);

    return traceId?.trim() || randomUUID();
};

const createSocketAuthenticationError = (auth: ISocketAuthenticationResult): Error => {
    const code = auth.reason === 'user_not_found'
        ? ErrorCodes.USER_NOT_FOUND
        : ErrorCodes.AUTHENTICATION_UNAUTHORIZED;
    const details = auth.reason === 'password_changed'
        ? 'Socket token is no longer valid after password change'
        : code;
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
};

export class SocketGateway{
    private io?: Server;
    private initialized = false;
    private modules: ISocketModule[] = [];

    #tokenService = new JwtTokenService();

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
            pingTimeout: 20_000,
            pingInterval: 10_000,
            perMessageDeflate: {
                threshold: 1024,
                zlibDeflateOptions: { chunkSize: 16 * 1024 },
                zlibInflateOptions: { chunkSize: 16 * 1024 }
            },
            maxHttpBufferSize: 512 * 1024 * 1024
        });

        /*
         * No cross-process adapter: rooms live in this process's memory.
         *
         * The adapter existed so a room emit on one replica reached sockets held
         * by another. Domain events do not depend on it — they travel over the
         * event bus, and every replica emits the ones it handles to its own
         * sockets. A direct room emit, however, now stays local, so running more
         * than one replica needs an adapter putting back.
         */
        socketIOEmitter.setServer(this.io);
        socketIORoomManager.setServer(this.io);

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
        const socketData = socket.data as SocketConnectionRuntimeData;

        logger.info(`@socket-gateway - connected socketId=${socket.id} traceId=${socketData.traceId} userId=${socketData.auth?.user?._id}`);

        socketIOEmitter.registerConnection(socket);
        socketIORoomManager.registerConnection(socket);
        socketIOEventRegistry.registerConnection(socket);

        const connection = toSocketConnection(socket);

        for(const module of this.modules){
            module.onConnection(connection);
        }

        socketIOEventRegistry.onDisconnect(socket.id, () => {
            socketIOEmitter.unregisterConnection(socket.id);
            socketIORoomManager.unregisterConnection(socket.id);
            socketIOEventRegistry.unregisterConnection(socket.id);
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
                let closeTimeout: NodeJS.Timeout | undefined;

                await Promise.race([
                    new Promise<void>((resolve) => {
                        this.io?.close(() => {
                            clearTimeout(closeTimeout);
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

        this.io = undefined;
        this.initialized = false;
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

        const user = await User.findOneBy({ id: decoded.id });

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

        const session = await Session.findOneBy({
            token,
            isActive: true
        });
        if (!session) {
            return {
                state: 'rejected',
                reason: 'invalid_token'
            };
        }

        return {
            state: 'authenticated',
            user: {
                _id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                avatar: user.avatar ?? undefined,
                teams: user.teams ?? [],
                role: user.role
            }
        };
    }

    private async authenticateSocket(
        socket: AuthenticatedSocket,
        next: (error?: Error) => void
    ): Promise<void>{
        const socketData = socket.data as SocketConnectionRuntimeData;
        socketData.traceId = resolveSocketTraceId(socket);

        try{
            const startedAt = Date.now();
            const auth = await this.authenticateSocketConnection(socket.handshake.auth?.token);

            socketData.auth = auth;

            if(auth.state === 'guest'){
                socket.user = null;
                logger.info(`@socket-auth outcome=guest socketId=${socket.id} traceId=${socketData.traceId} durationMs=${Date.now() - startedAt}`);
                return next();
            }

            if(auth.state === 'rejected' || !auth.user){
                socket.user = null;
                logger.warn(`@socket-auth outcome=rejected reason=${auth.reason} socketId=${socket.id} traceId=${socketData.traceId}`);
                return next(createSocketAuthenticationError(auth));
            }

            socket.user = auth.user;

            logger.info(`@socket-auth outcome=authenticated socketId=${socket.id} userId=${auth.user._id} traceId=${socketData.traceId}`);
            next();
        }catch{
            socket.user = null;
            logger.error(`@socket-auth socketId=${socket.id} traceId=${socketData.traceId}`);
            next(createSocketAuthenticationError({
                state: 'rejected',
                reason: 'invalid_token'
            }));
        }
    }
}

const socketGateway = new SocketGateway();

export default socketGateway;
