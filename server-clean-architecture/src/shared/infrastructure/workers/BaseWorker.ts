import { parentPort } from 'node:worker_threads';
import logger from '@/src/shared/infrastructure/logger';
import '@/src/core/env';
import mongoConnector from '../utilities/mongo-connector';

export default abstract class BaseWorker<TJob>{
    constructor(){
        this.setupProcessHandlers();
        this.listen();
    }

    private setupProcessHandlers(){
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

    private listen(){
        parentPort?.on('message', async (message: { job: TJob }) => {
            if(!message?.job){
                logger.error(`@worker #${process.pid} - received invalid message payload`);
                return;
            }

            try{
                await this.perform(message.job);
            }catch(fatalError: any){
                logger.error(`@worker #${process.pid} - fatal unhandled error: ${fatalError}`);
                parentPort?.postMessage({
                    status: 'failed',
                    jobId: (message.job as any).jobId || 'unknown',
                    error: fatalError.message || 'Fatal worker crash'
                })
            }
        });
    }

    protected async connectDB(){
        try{
            await mongoConnector();
            logger.info(`@worker #${process.pid} - connected to database`);
        }catch(dbError: any){
            logger.error(`@worker #${process.pid} - failed to connect to database: ${dbError}`);
        }
    }

    protected sendMessage(message: any){
        parentPort?.postMessage(message);
    }

    protected async setup(): Promise<void>{
        // Default implementation
    }

    /**
     * Main logic for processing a job.
     */
    protected abstract perform(job: TJob): Promise<void>;

    public static start<T extends BaseWorker<any>>(WorkerClass: new () => T){
        const worker = new WorkerClass();
        worker.setup().then(() => {
            logger.info(`@worker #${process.pid} - online ${WorkerClass.name} ready`);
        }).catch((error) => {
            logger.error(`@worker #${process.pid} - failed to initialize ${WorkerClass.name}: ${error.message}`);
            process.exit(1);
        });
    }
};