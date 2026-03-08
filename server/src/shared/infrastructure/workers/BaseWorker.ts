import { parentPort } from 'node:worker_threads';
import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/infrastructure/logger';
import mongoConnector from '@shared/infrastructure/utilities/mongo-connector';
import {
    createWorkerFailureMessage,
    normalizeWorkerFailureEnvelope,
    type WorkerFailureEnvelope
} from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import '@core/config/env';

type JobWithProps = {
    props: Record<string, unknown>;
};

const isJobWithProps = (value: unknown): value is JobWithProps => {
    return typeof value === 'object' && value !== null && 'props' in value;
};

export default abstract class BaseWorker<TJob> {
    constructor() {
        this.setupProcessHandlers();
    }

    public async init(): Promise<void> {
        await this.setup();
        this.listen();
    }

    private setupProcessHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error(`@worker #${process.pid} - uncaught exception: ${error.message}`);
            logger.error(`@worker #${process.pid} - stack: ${error.stack}`);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error(`@worker #${process.pid} - unhandler rejection at: ${promise} reason: ${reason}`);
            process.exit(1);
        });
    }

    private listen() {
        parentPort?.on('message', async (message: { job: TJob }) => {
            if (!message?.job) {
                logger.error(`@worker #${process.pid} - received invalid message payload`);
                return;
            }

            const normalizedJob = isJobWithProps(message.job)
                ? message.job
                : {
                    props: message.job as Record<string, unknown>
                };

            try {
                await this.perform(normalizedJob as TJob);
            } catch (fatalError: unknown) {
                const failure = normalizeWorkerFailureEnvelope({
                    error: fatalError,
                    fallbackCode: ErrorCodes.WORKER_FAILURE
                });

                logger.error(`@worker #${process.pid} - fatal unhandled error: ${fatalError}`);
                parentPort?.postMessage(createWorkerFailureMessage({
                    jobId: (normalizedJob.props.jobId as string | undefined) || 'unknown',
                    failure
                }));
            }
        });
    }

    protected async connectDB() {
        try {
            await mongoConnector();
            logger.info(`@worker #${process.pid} - connected to database`);
        } catch (dbError: any) {
            logger.error(`@worker #${process.pid} - failed to connect to database: ${dbError}`);
        }
    }

    protected sendMessage(message: any) {
        parentPort?.postMessage(message);
    }

    protected sendFailure(jobId: string, failure: WorkerFailureEnvelope, metadata?: Record<string, unknown>) {
        this.sendMessage(createWorkerFailureMessage({
            jobId,
            failure,
            metadata
        }));
    }

    protected async setup(): Promise<void> {
        // Default implementation
    }

    /**
     * Main logic for processing a job.
     */
    protected abstract perform(job: TJob): Promise<void>;

    public static start<T extends BaseWorker<any>>(WorkerClass: new () => T) {
        const worker = new WorkerClass();
        worker.init().then(() => {
            logger.info(`@worker #${process.pid} - online ${WorkerClass.name} ready`);
        }).catch((error) => {
            logger.error(`@worker #${process.pid} - failed to initialize ${WorkerClass.name}: ${error.message}`);
            process.exit(1);
        });
    }
};
