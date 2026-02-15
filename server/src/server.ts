import 'reflect-metadata';
import './core/config/env';
import './core/bootstrap/register-deps';

import { initializeRedis, redis } from './core/config/redis';
import { initializeMinio } from './core/config/minio';
import { registerAllSubscribers } from './core/events/registerAllSubscribers';
import { container } from 'tsyringe';
import logger from './shared/infrastructure/logger';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';
import mongoose from 'mongoose';
import SocketGateway from './modules/socket/infrastructure/gateway/SocketGateway';
import mountHttpRoutes from './core/bootstrap/mount-http-routes';
import startQueues from './core/bootstrap/start-queues';
import app from './core/config/express';
import http from 'http';
import os from 'node:os';
import { Request, Response, NextFunction } from 'express';

const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const timeout = parseInt(process.env.SERVER_TIMEOUT ?? '1800000');
if (isNaN(timeout)) throw new Error('SERVER_TIMEOUT must be a number');
const SERVER_TIMEOUT = timeout;

process.on('unhandledRejection', (reason: any) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`@server: unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@server: uncaught exception: ${error.stack || error.message}`);
});

const startServer = async () => {
    const server = http.createServer(app);
    app.use(mountHttpRoutes());

    // CORE-003: Global error-handling middleware (must be after all routes)
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error('Unhandled error:', err);
        res.status(500).json({ error: 'Internal server error' });
    });

    server.setTimeout(SERVER_TIMEOUT);
    server.requestTimeout = SERVER_TIMEOUT;
    server.keepAliveTimeout = SERVER_TIMEOUT;
    server.headersTimeout = SERVER_TIMEOUT;

    server.on('error', (error) => {
        logger.error(`@server: http server error: ${error}`)
    });

    // CORE-002: Graceful shutdown
    const shutdown = async () => {
        logger.info('Shutting down...');
        server.close();
        try { await mongoose.disconnect(); } catch (e) { /* ignore */ }
        try { if (redis) await redis.quit(); } catch (e) { /* ignore */ }
        process.exit(0);
    };

    // CORE-013: Register signal handlers at top level of startServer, not inside listen callback
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // CORE-001: Initialize all infrastructure BEFORE server.listen()
    const clusterId = process.env.CLUSTER_ID || os.hostname();
    await Promise.all([
        initializeRedis(),
        mongoConnector(),
        initializeMinio()
    ]);

    if (redis) {
        await redis.zadd('active_clusters', Date.now(), clusterId);
        logger.info(`@server: registered ${clusterId} to active_clusters`);
    }

    await registerAllSubscribers();

    const socketGateway = container.resolve(SocketGateway);
    const socketModules = container.resolveAll<any>('SocketModule');
    for (const module of socketModules) {
        socketGateway.register(module);
    }
    await socketGateway.initialize(server);

    await startQueues();

    server.listen(SERVER_PORT as number, SERVER_HOST, () => {
        logger.info(`@server: running at http://${SERVER_HOST}:${SERVER_PORT}/`);
    });
};

// CORE-015: Add .catch() to startServer() call
startServer().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
