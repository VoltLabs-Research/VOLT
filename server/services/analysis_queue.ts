import OpenDXAService from '@services/opendxa';
import { redis, createRedisClient } from '@config/redis'; 
import IORedis from 'ioredis';

interface AnalysisJob{
    trajectoryId: string;
    folderPath: string;
    config: any;
    trajectoryFiles: string[];
}

export class AnalysisProcessingQueue{
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
        
        this.startWorkers();
    }

    private startWorkers(): void{
        for(let i = 0; i < this.maxConcurrentJobs; i++){
            this.runWorker(i + 1);
        }
    }

    private async runWorker(workerId: number): Promise<void>{
        const workerRedis = createRedisClient();
        this.workerClients.push(workerRedis);

        while(!this.isShutdown){
            try{
                const rawData = await workerRedis.brpoplpush(this.queueKey, this.processingKey, 0);

                if(rawData){
                    this.activeWorkers++;
                    const job = JSON.parse(rawData) as AnalysisJob;
                    await this.executeJob(job, rawData, workerId);
                    this.activeWorkers--;
                    console.log(`[Worker #${workerId}] Finished job.`);
                }
            }catch(error){
                if(this.isShutdown || (error instanceof Error && error.message.includes('Connection is closed'))){
                    break; 
                }
                console.error(`[Worker #${workerId}] Error in worker loop.`, error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        await workerRedis.quit();
    }
    
    private async executeJob(job: AnalysisJob, rawData: string, workerId: number): Promise<void>{
        await this.setJobStatus(job.trajectoryId, 'running', { workerId });
        try{
            const opendxa = new OpenDXAService(job.trajectoryId, job.folderPath);
            const result = await opendxa.analyzeTrajectory(job.trajectoryFiles, job.config);
            await this.setJobStatus(job.trajectoryId, 'completed',{ result });
        } catch(error){
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.setJobStatus(job.trajectoryId, 'failed',{ error: errorMessage, workerId });
        } finally{
            await redis.lrem(this.processingKey, 1, rawData);
        }
    }

    public async addJob(job: AnalysisJob): Promise<void>{
        await redis.lpush(this.queueKey, JSON.stringify(job));
        await this.setJobStatus(job.trajectoryId, 'queued');
    }

    public async getStatus(){
        const [pending, processing] = await redis.multi()
            .llen(this.queueKey)
            .llen(this.processingKey)
            .exec();

        return{ 
            maxConcurrent: this.maxConcurrentJobs, 
            activeWorkers: this.activeWorkers, 
            pendingJobs: pending[1] as number, 
            processingJobs: processing[1] as number 
        };
    }

    public async getJobStatus(trajectoryId: string): Promise<any>{
        const statusData = await redis.get(`${this.statusKeyPrefix}${trajectoryId}`);
        return statusData ? JSON.parse(statusData) : { status: 'not_found' };
    }

    private async setJobStatus(trajectoryId: string, status: string, data: any ={}): Promise<void>{
        const statusData ={ trajectoryId, status, timestamp: new Date().toISOString(), ...data };
        const statusString = JSON.stringify(statusData);
        
        await redis.set(`${this.statusKeyPrefix}${trajectoryId}`, statusString, 'EX', 86400);
        await redis.publish(this.statusChannel, statusString);
    }
}

let analysisProcessingQueue: AnalysisProcessingQueue | null = null;

export const getAnalysisProcessingQueue =(): AnalysisProcessingQueue =>{
    if(!analysisProcessingQueue){
        analysisProcessingQueue = new AnalysisProcessingQueue();
    }
    return analysisProcessingQueue;
};