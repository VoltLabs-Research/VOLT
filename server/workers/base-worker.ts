import { parentPort } from 'node:worker_threads';
import logger from '@/logger';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import '@config/env';

export abstract class BaseWorker<TJob> {
    constructor() {
        this.setupProcessHandlers();
        this.listen();
    }

    private setupProcessHandlers() {
        process.on('uncaughtException', (err) => {
            logger.error(`[Worker #${process.pid}] Uncaught Exception: ${err.message}`);
            logger.error(`[Worker #${process.pid}] Stack: ${err.stack}`);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error(`[Worker #${process.pid}] Unhandled Rejection at: ${promise} reason: ${reason}`);
            process.exit(1);
        });
    }

    private listen() {
        parentPort?.on('message', async (message: { job: TJob }) => {
            if (!message?.job) {
                logger.error(`[Worker #${process.pid}] Received invalid message payload`);
                return;
            }

            try {
                await this.perform(message.job);
            } catch (fatalError: any) {
                logger.error(`[Worker #${process.pid}] Fatal Unhandled Error: ${fatalError}`);
                parentPort?.postMessage({
                    status: 'failed',
                    jobId: (message.job as any)?.jobId || 'unknown',
                    error: fatalError.message || 'Fatal worker crash'
                });
            }
        });
    }

    protected async connectDB() {
        try {
            await mongoConnector();
            logger.info(`[Worker #${process.pid}] Connected to MongoDB.`);
        } catch (dbError: any) {
            logger.error(`[Worker #${process.pid}] Failed to connect to MongoDB: ${dbError.message}`);
            process.exit(1);
        }
    }

    protected sendMessage(message: any) {
        parentPort?.postMessage(message);
    }

    /**
     * Optional setup method to run before listening for messages.
     * Useful for connecting to DBs, initializing services, etc.
     */
    protected async setup(): Promise<void> {
        // Default implementation does nothing
    }

    /**
     * Main logic for processing a job.
     */
    protected abstract perform(job: TJob): Promise<void>;

    public static start<T extends BaseWorker<any>>(WorkerClass: new () => T) {
        const worker = new WorkerClass();
        worker.setup().then(() => {
            logger.info(`[Worker #${process.pid}] Online - ${WorkerClass.name} Ready`);
        }).catch(err => {
            logger.error(`[Worker #${process.pid}] Failed to initialize ${WorkerClass.name}: ${err.message}`);
            process.exit(1);
        });
    }
}
