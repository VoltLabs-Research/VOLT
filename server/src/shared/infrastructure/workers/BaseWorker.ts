import { parentPort } from 'node:worker_threads';
import { ErrorCodes } from '@core/constants/error-codes';
import logger from '@shared/infrastructure/logger';
import mongoConnector from '@shared/infrastructure/utilities/mongo-connector';
import '@core/config/env';
import { createWorkerFailureMessage, normalizeWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import type { WorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';

interface WorkerMessage<TJob> {
    job: TJob;
};

type WorkerJobProps = {
    jobId?: string;
};

type WorkerLikeJob = {
    props?: WorkerJobProps;
};

const getWorkerJobId = (job: unknown): string => {
    if (typeof job !== 'object' || job === null || !('props' in job)) {
        return 'unknown';
    }

    const props = job.props;

    if (typeof props !== 'object' || props === null || !('jobId' in props)) {
        return 'unknown';
    }

    return typeof props.jobId === 'string' ? props.jobId : 'unknown';
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
        parentPort?.on('message', async (message: WorkerMessage<TJob>) => {
            if (!message?.job) {
                logger.error(`@worker #${process.pid} - received invalid message payload`);
                return;
            }

            try {
                await this.perform(message.job);
            } catch (fatalError: unknown) {
                const failure = normalizeWorkerFailureEnvelope({
                    error: fatalError,
                    fallbackCode: ErrorCodes.WORKER_FAILURE
                });

                logger.error(`@worker #${process.pid} - fatal unhandled error: ${fatalError}`);
                parentPort?.postMessage(createWorkerFailureMessage({
                    jobId: getWorkerJobId(message.job),
                    failure
                }));
            }
        });
    }

    protected async connectDB() {
        try {
            await mongoConnector();
            logger.info(`@worker #${process.pid} - connected to database`);
        } catch (dbError: unknown) {
            logger.error(`@worker #${process.pid} - failed to connect to database: ${dbError}`);
        }
    }

    protected sendMessage(message: Record<string, unknown>): void {
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

    public static start<T extends BaseWorker<unknown>>(WorkerClass: new () => T) {
        const worker = new WorkerClass();
        worker.init().then(() => {
            logger.info(`@worker #${process.pid} - online ${WorkerClass.name} ready`);
        }).catch((error) => {
            logger.error(`@worker #${process.pid} - failed to initialize ${WorkerClass.name}: ${error.message}`);
            process.exit(1);
        });
    }
};
