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

const CLUSTER_ID = process.env.CLUSTER_ID || 'default';

const main = async () => {
    logger.info(`[Worker] Starting worker process (Cluster: ${CLUSTER_ID})...`);

    try {
        await initializeRedis();
        logger.info('[Worker] Redis initialized');

        await initializeMinio();
        logger.info('[Worker] MinIO initialized');

        await mongoConnector();
        logger.info('[Worker] MongoDB connection established');

        // Initialize queues
        // This triggers the startup recovery and dispatch loop for each queue
        logger.info('[Worker] Initializing queues...');

        getAnalysisQueue();
        logger.info('[Worker] Analysis Queue initialized');

        getTrajectoryProcessingQueue();
        logger.info('[Worker] Trajectory Processing Queue initialized');

        getRasterizerQueue();
        logger.info('[Worker] Rasterizer Queue initialized');

        getSSHImportQueue();
        logger.info('[Worker] SSH Import Queue initialized');

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
