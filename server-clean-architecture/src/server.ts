import http from 'http';
import app from './core/express';
import logger from './shared/infrastructure/logger';
import os from 'node:os';
import { initializeRedis, redis } from './core/redis';
import { initializeMinio } from './core/minio';
import mongoConnector from './shared/infrastructure/utilities/mongo-connector';

const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || '0.0.0.0';
const SERVER_TIMEOUT = parseInt(process.env.SERVER_TIMEOUT ?? '1800000');

const server = http.createServer(app);

/**
 * Useful when uploading large simulations from the client to the server.
 */
server.setTimeout(SERVER_TIMEOUT);
server.requestTimeout = SERVER_TIMEOUT;
server.keepAliveTimeout = SERVER_TIMEOUT;
server.headersTimeout = SERVER_TIMEOUT;

const shutdown = async () => {
    process.exit(0);
};

process.on('unhandledRejection', (reason: any) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`@server: unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`@server: uncaught exception: ${error.stack || error.message}`);
});

server.on('error', (error) => {
    logger.error(`@server: http server error: ${error}`)
});

server.listen(SERVER_PORT as number, SERVER_HOST, async () => {
    const clusterId = process.env.CLUSTER_ID || os.hostname();
    
    await initializeRedis();
    if(redis){
        await redis.zadd('active_clusters', Date.now(), clusterId);
        logger.info(`@server: registered ${clusterId} to active_clusters`);
    }

    await initializeMinio();
    await mongoConnector();

    logger.info(`@server: running at http://${SERVER_HOST}:${SERVER_PORT}/`);

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
});