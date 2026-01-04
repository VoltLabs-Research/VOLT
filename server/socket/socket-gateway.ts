import http from 'http';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import BaseSocketModule from '@/socket/base-socket-module';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from '@/config/redis';
import { User } from '@/models/index';
import { initializeJobUpdatesListener } from '@/socket/job-updates-listener';
import { initializeTrajectoryUpdatesListener } from '@/socket/trajectory-updates-listener';
import ContainerModule from '@/socket/modules/containers';
import JobsModule from '@/socket/modules/jobs';
import TeamPresenceModule from '@/socket/modules/team-presence';
import logger from '@/logger';

/**
 * Central gateway that:
 * - Creates and holds the SocketIO server instance.
 * - Attaches the Redis adapter for multi-node setups.
 * - Registers feature modules and forwards connection events to them.
 */
class SocketGateway {
    private io?: Server;
    private adapterPub?: Redis;
    private adapterSub?: Redis;
    private jobUpdatesSubscriber?: Redis;
    private trajectoryUpdatesSubscriber?: Redis;
    private initialized = false;
    private modules: BaseSocketModule[] = [];

    constructor(
        private corsOrigins: string[] = [
            process.env.CLIENT_DEV_HOST as string,
            process.env.CLIENT_HOST as string,
        ],
        private pingTimeout = 60_000,
        private pingInterval = 25_000
    ) { }

    /**
     * Register a feature module(before initialize()).
     */
    register(module: BaseSocketModule): this {
        this.modules.push(module);
        return this;
    }

    /**
     * Initialize Socket.IO on top of the HTTP server and set up Redis adapter.
     */
    async initialize(server: http.Server): Promise<Server> {
        if (this.initialized && this.io) return this.io;

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

        // Configure Redis adapter with extended timeout for fetchSockets
        this.io.adapter(createAdapter(this.adapterPub, this.adapterSub, {
            requestsTimeout: 10000, // 10 seconds timeout for fetchSockets operations
        }));

        // Add authentication middleware(allows anonymous users for public trajectories)
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth?.token;

                // Allow anonymous connections(for public trajectories)
                if (!token) {
                    (socket as any).user = null;
                    logger.info(`[Socket Gateway] Anonymous user connected: ${socket.id}`);
                    return next();
                }

                const secret = process.env.SECRET_KEY as string;
                const decoded = jwt.verify(token, secret) as any;

                const user = await User.findById(decoded.id).select('-password');
                if (!user) {
                    // Invalid token but allow anonymous access(socket as any).user = null;
                    logger.info(`[Socket Gateway] User not found for token, allowing anonymous: ${socket.id}`);
                    return next();
                }

                (socket as any).user = user;
                logger.info(`[Socket Gateway] Authenticated user connected: ${user.firstName} ${user.lastName} (${socket.id})`);
                next();
            } catch (error) {
                // Token verification failed, allow anonymous access(socket as any).user = null;
                logger.info(`[Socket Gateway] Token verification failed, allowing anonymous: ${socket.id}`);
                next();
            }
        });

        // Register built-in modules
        this.register(new ContainerModule());
        this.register(new JobsModule());
        this.register(new TeamPresenceModule());

        for (const module of this.modules) {
            module.onInit(this.io);
        }

        // Initialize job updates listener
        this.jobUpdatesSubscriber = initializeJobUpdatesListener(this.io);

        // Initialize trajectory updates listener
        this.trajectoryUpdatesSubscriber = initializeTrajectoryUpdatesListener(this.io);

        this.io.on('connection', (socket: Socket) => {
            logger.info(`[Socket Gateway] Connected ${socket.id}`);
            for (const module of this.modules) {
                module.onConnection(socket);
            }
        });

        this.initialized = true;
        return this.io;
    }

    /**
     * Graceful shutdown: close io, adapter redis, and notify modules.
     */
    async close(): Promise<void> {
        try {
            await Promise.all(this.modules.map((module) => module.onShutdown()));
        } catch (err: any) {
            logger.error(`[Socket Gateway] Module shutdown error ${err}`);
        }

        try {
            await new Promise<void>((res) => {
                if (this.io) {
                    this.io.close(() => res());
                } else {
                    res();
                }
            });
        } catch { }

        try {
            await this.adapterPub?.quit();
        } catch { }

        try {
            await this.adapterSub?.quit();
        } catch { }

        try {
            await this.jobUpdatesSubscriber?.quit();
        } catch { }

        try {
            await this.trajectoryUpdatesSubscriber?.quit();
        } catch { }

        this.io = undefined;
        this.adapterPub = undefined;
        this.adapterSub = undefined;
        this.jobUpdatesSubscriber = undefined;
        this.trajectoryUpdatesSubscriber = undefined;
        this.initialized = false;
    }

    /**
     * Return the initialized SocketIO server.
     */
    getIO(): Server {
        if (!this.io) {
            throw new Error('SocketIO not initialized');
        }

        return this.io;
    }
}

export default SocketGateway;
