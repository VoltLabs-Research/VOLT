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

const main = async () => {
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

        // Recover trajectory job counters
        const trajectoryJobTracker = (await import('@/services/trajectory-job-tracker')).default;
        await trajectoryJobTracker.recoverCounters();
        logger.info('[Worker] Trajectory job counters recovered');

        // Initialize queues
        // This triggers the startup recovery and dispatch loop for each queue
        logger.info('[Worker] Initializing queues...');

        getAnalysisQueue();
        logger.info('[Worker] Analysis Queue initialized');

        logger.info(`[Worker] Worker is now running and processing jobs for Cluster: ${CLUSTER_ID}`);
    } catch (error) {
        logger.error(`[Worker] Fatal error during startup: ${error}`);
        process.exit(1);
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
