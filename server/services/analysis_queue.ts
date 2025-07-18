import OpenDXAService from '@services/opendxa';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { redis } from '@config/redis';
import { existsSync } from 'fs';
import { join } from 'path';

interface AnalysisJob{
    folderId: string;
    folderPath: string;
    analysisPath: string;
    config: any;
    trajectoryFiles: string[];
}

export class AnalysisProcessingQueue{
    private isProcessing = false;
    private readonly queueKey = 'analysis_queue';
    private readonly processingKey = 'analysis_processing';
    private readonly statusKeyPrefix = 'analysis_status';

    constructor(){
        this.startProcessingLoop();
    }

    public async addJob(job: AnalysisJob): Promise<void>{
        await redis!.lpush(this.queueKey, JSON.stringify(job));
        await this.setJobStatus(job.folderId, 'queued');
    }

    public async getStatus(){
        const [pending, processing, queuedData, processingData] = await redis!.multi()
            .llen(this.queueKey)
            .llen(this.processingKey)
            .lrange(this.queueKey, 0, -1)
            .lrange(this.processingKey, 0, -1)
            .exec();
        
        return {
            isProcessing: this.isProcessing,
            pendingJobs: pending[1] as number,
            processingJobs: processing[1] as number,
            queuedJobs: (queuedData[1] as string[]).map(this.parseJobId),
            processingJobsList: (processingData[1] as string[]).map(this.parseJobId)
        };
    }

    public async getJobStatus(folderId: string): Promise<any>{
        const statusData = await redis!.get(`${this.statusKeyPrefix}${folderId}`);
        return JSON.parse(statusData || '{}');
    }

    private async startProcessingLoop(): Promise<void>{
        if(this.isProcessing) return;
        this.isProcessing = true;
        const job = await this.getNextJob();
        if(job){
            await this.executeJob(job);
        }
        this.isProcessing = false;
        // call the next cycle safely
        setImmediate(() => this.startProcessingLoop());
    }

    private async executeJob({ job, rawData }: { job: AnalysisJob, rawData?: string }): Promise<void>{
        await this.setJobStatus(job.folderId, 'running');
        try{
            if(!existsSync(job.analysisPath)){
                await mkdir(job.analysisPath, { recursive: true });
            }

            const opendxa = new OpenDXAService();
            opendxa.configure(job.config);
            const result = await opendxa.analyzeTrajectory(job.trajectoryFiles, join(job.analysisPath, 'frame_{}'));
            await this.setJobStatus(job.folderId, 'completed', { result });
        }catch(error){
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Job failed for ${job.folderId}:`, errorMessage);
        }finally{
            if(rawData){
                await redis!.lrem(this.processingKey, 1, rawData);
            }
        }
    }

    private parseJobId(jobData: string): string{
        try{
            return JSON.parse(jobData).folderId;
        }catch{
            return 'invalid_job_data';
        }
    }

    private async setJobStatus(folderId: string, status: string, data: any = {}): Promise<void>{
        const statusData = { status, timestamp: new Date().toISOString(), ...data };
        await redis!.set(`${this.statusKeyPrefix}${folderId}`, JSON.stringify(statusData), 'EX', 86400);
    }

    private async getNextJob(): Promise<{ job: AnalysisJob, rawData?: string } | null>{
        try{
            const rawData = await redis!.brpoplpush(this.queueKey, this.processingKey, 1);
            if(rawData){
                return { job: JSON.parse(rawData), rawData }
            }
        }catch(error){
            console.error('Error getting job from Redis. Checking memory queue.', error);
        }

        return null;
    }
}

// Singleton!
let analysisProcessingQueue: AnalysisProcessingQueue | null = null;

export const getAnalysisProcessingQueue = (): AnalysisProcessingQueue => {
    if(!analysisProcessingQueue){
        analysisProcessingQueue = new AnalysisProcessingQueue();
    }
    return analysisProcessingQueue;
}