import { Worker, WorkerOptions } from 'worker_threads';
import path from 'path';
import IORedis from 'ioredis';
import { createRedisClient, redis } from '../config/redis';

interface AnalysisJob{
    trajectoryId: string;
    folderPath: string;
    config: any;
    trajectoryFiles: string[];
}

export class AnalysisProcessingQueue {
    private readonly queueKey: string;
    private readonly processingKey: string;
    private readonly statusKeyPrefix: string;
    private readonly statusChannel: string;
    private readonly maxConcurrentJobs: number;

    private activeWorkers = 0;
    private isShutdown = false;
    private workerClients: IORedis[] = [];

    constructor(){
        this.queueKey = process.env.ANALYSIS_QUEUE_NAME as string || 'analysis_queue';
        this.processingKey = `${this.queueKey}:processing`;
        this.statusKeyPrefix = `${this.queueKey}:status:`;
        this.statusChannel = 'analysis-status-updates';
        this.maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_ANALYSES || '2', 10);
        this.startManager();
    }

    private startManager(): void{
        for(let i = 0; i < this.maxConcurrentJobs; i++){
            this.runQueueListener(i + 1);
        }
    }

    private async runQueueListener(managerId: number): Promise<void>{
        const listenerRedis = createRedisClient();
        this.workerClients.push(listenerRedis);
        while(!this.isShutdown){
            try{
                const rawData = await listenerRedis.brpoplpush(this.queueKey, this.processingKey, 0);

                if(rawData && !this.isShutdown){
                    this.activeWorkers++;
                    const job = JSON.parse(rawData) as AnalysisJob;
                    await this.executeJobInWorker(job, rawData, managerId);
                    this.activeWorkers--;
                }
            }catch(error){
                if(this.isShutdown || (error instanceof Error && error.message.includes('Connection is closed'))){
                    break;
                }

                console.error(`[Manager #${managerId}] Error in the manager loop.`, error);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }

        await listenerRedis.quit();
    }

    private executeJobInWorker(job: AnalysisJob, rawData: string, managerId: number): Promise<void>{
        return new Promise((resolve, reject) => {
            console.log(`[Manager #${managerId}] Starting a worker thread for job: ${job.trajectoryId}`);
            const workerPath = path.resolve(__dirname, '../workers/analysis.ts');
            const workerOptions: WorkerOptions = {
                workerData: { job },
                execArgv: ['-r', 'ts-node/register', '-r', 'tsconfig-paths/register']
            };

            const worker = new Worker(workerPath, workerOptions);

            worker.on('message', async (message) => {
                switch(message.status){
                    case 'running':
                        await this.setJobStatus(job.trajectoryId, 'running', { workerId: managerId });
                        break;
                    
                    case 'completed':
                        await this.setJobStatus(job.trajectoryId, 'completed', { result: message.result });
                        await redis!.lrem(this.processingKey, 1, rawData);
                        resolve();
                        break;

                    case 'failed':
                        await this.setJobStatus(job.trajectoryId, 'failed', { error: message.error, workerId: managerId });
                        await redis!.lrem(this.processingKey, 1, rawData);
                        reject(new Error(message.error));
                        break;
                }
            });

            worker.on('error', async (err) => {
                console.error(`[Manager #${managerId}] Error in worker thread for ${job.trajectoryId}:`, err);
                await this.setJobStatus(job.trajectoryId, 'failed', { error: err.message, workerId: managerId });
                await redis!.lrem(this.processingKey, 1, rawData);
                reject(err);
            });

            worker.on('exit', (code) => {
                if(code !== 0){
                    this.getJobStatus(job.trajectoryId).then(status => {
                        if(status.status !== 'completed' && status.status !== 'failed'){
                            const errorMsg = `The worker exited unexpectedly with code ${code}`;

                            console.error(`[Manager #${managerId}]`, errorMsg);
                            this.setJobStatus(job.trajectoryId, 'failed', { error: errorMsg, workerId: managerId });
                            redis!.lrem(this.processingKey, 1, rawData);

                            reject(new Error(errorMsg));
                        }
                    });
                }
            });
        });
    }

    public async addJob(job: AnalysisJob): Promise<void> {
        await redis!.lpush(this.queueKey, JSON.stringify(job));
        await this.setJobStatus(job.trajectoryId, 'queued');
    }

    public async getStatus() {
        const [pending, processing] = await redis!.multi().llen(this.queueKey).llen(this.processingKey).exec();
        return {
            maxConcurrent: this.maxConcurrentJobs,
            activeWorkers: this.activeWorkers,
            pendingJobs: (pending[1] as number) || 0,
            processingJobs: (processing[1] as number) || 0,
        };
    }

    public async getJobStatus(trajectoryId: string): Promise<any> {
        const statusData = await redis!.get(`${this.statusKeyPrefix}${trajectoryId}`);
        return statusData ? JSON.parse(statusData) : { status: 'not_found' };
    }

    private async setJobStatus(trajectoryId: string, status: string, data: any = {}): Promise<void> {
        const statusData = { trajectoryId, status, timestamp: new Date().toISOString(), ...data };
        const statusString = JSON.stringify(statusData);
        await redis!.set(`${this.statusKeyPrefix}${trajectoryId}`, statusString, 'EX', 86400);
        await redis!.publish(this.statusChannel, statusString);
    }
}

let analysisProcessingQueue: AnalysisProcessingQueue | null = null;

export const getAnalysisProcessingQueue = (): AnalysisProcessingQueue => {
    if(!analysisProcessingQueue){
        analysisProcessingQueue = new AnalysisProcessingQueue();
    }

    return analysisProcessingQueue;
};