/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Worker entry point.
 * This file handles the initialization of processing queues without starting the web server.
 * It is designed for horizontal scaling.
 */

import 'dotenv/config';
import logger from '@/logger';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import { initializeRedis } from '@config/redis';
import { initializeMinio } from '@/config/minio';
import {
    getAnalysisQueue,
    getTrajectoryProcessingQueue,
    getRasterizerQueue,
    getSSHImportQueue
} from '@/queues';

import { redis } from '@/config/redis';

const CLUSTER_ID = process.env.CLUSTER_ID || 'default';
let initialized = false;

process.on('unhandledRejection', (reason: any) => {
    const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
    logger.error(`[Worker] Unhandled rejection: ${message}`);
});

process.on('uncaughtException', (error: Error) => {
    logger.error(`[Worker] Uncaught exception: ${error.stack || error.message}`);
});

const main = async (): Promise<void> => {
    if (initialized) return;

    logger.info(`[Worker] Starting worker process (Cluster: ${CLUSTER_ID})...`);

    try {
        await initializeRedis();
        logger.info('[Worker] Redis initialized');

        // Register this worker in the active clusters sorted set (with timestamp for stale detection)
        if (redis) {
            await redis.zadd('active_clusters', Date.now(), CLUSTER_ID);
        }
        logger.info(`[Worker] Registered ${CLUSTER_ID} to active_clusters`);

        await initializeMinio();
        logger.info('[Worker] MinIO initialized');

        await mongoConnector();
        logger.info('[Worker] MongoDB connection established');

        // Job cleanup is now handled automatically via EventBus

        // Initialize queues
        // This triggers the startup recovery and dispatch loop for each queue
        logger.info('[Worker] Initializing queues...');

        getAnalysisQueue();
        logger.info('[Worker] Analysis Queue initialized');

        initialized = true;
        logger.info(`[Worker] Worker is now running and processing jobs for Cluster: ${CLUSTER_ID}`);
    } catch (error) {
        logger.error(`[Worker] Fatal error during startup: ${error}. Retrying in 5s...`);
        setTimeout(main, 5000);
    }
};

const shutdown = async () => {
    logger.info('[Worker] Shutting down...');
    // Add any specific cleanup logic here if needed
    // Queue shutdown is typically handled by process exit/redis timeout
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
