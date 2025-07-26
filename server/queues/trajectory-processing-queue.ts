import { BaseProcessingQueue } from '@/queues/base-processing-queue';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import { redis } from '@/config/redis';
import path from 'path';
import { emitJobUpdate } from '@/config/socket';

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
    constructor(){
        const options: QueueOptions = {
            queueName: 'trajectory-processing-queue',
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: 2,
            cpuLoadThreshold: 60,
            ramLoadThreshold: 70,
        };
        
        super(options);
    }

    protected deserializeJob(rawData: string): TrajectoryProcessingJob {
        try{
            return JSON.parse(rawData) as TrajectoryProcessingJob;
        }catch(error){
            console.error(`[${this.queueName}] Error deserializing job:`, error);
            throw new Error('Failed to deserialize job data');
        }
    }

    // Override addJobs to handle memory pressure and emit socket updates
    public async addJobs(jobs: TrajectoryProcessingJob[]): Promise<void> {
        if(jobs.length === 0) return;

        console.log(`[${this.queueName}] Adding ${jobs.length} jobs to queue`);
        
        // Add jobs one by one to prevent memory spike
        for(const job of jobs){
            try{
                const stringifiedJob = JSON.stringify(job);
                await redis!.lpush(this.queueKey, stringifiedJob);
                await this.setJobStatus(job.jobId, 'queued', {
                    progress: 0,
                    chunkIndex: job.chunkIndex,
                    totalChunks: job.totalChunks,
                    teamId: job.teamId
                });
                console.log(`[${this.queueName}] Added and emitted update for job ${job.jobId} for team ${job.teamId}`);
                await new Promise(resolve => setTimeout(resolve, 50));
            }catch(error){
                console.error(`[${this.queueName}] Error adding job ${job.jobId}:`, error);
            }
        }
        
        console.log(`[${this.queueName}] Successfully added all jobs to queue`);
    }
}