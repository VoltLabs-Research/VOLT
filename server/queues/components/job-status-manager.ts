import IORedis from 'ioredis';
import { BaseJob } from '@/types/queues/base-processing-queue';

export class JobStatusManager<T extends BaseJob> {
    constructor(
        private redisClient: IORedis,
        private statusKeyPrefix: string,
        private jobMap: Map<number, any>,
        private queueName: string
    ) {}

    async setJobStatus(jobId: string, status: string, data: any): Promise<void> {
        const statusData = {
            jobId,
            status,
            timestamp: new Date().toISOString(),
            queueType: this.queueName,
            ...data
        };

        const statusKey = `${this.statusKeyPrefix}${jobId}`;
        const teamId = data.teamId;

        await this.redisClient.set(statusKey, JSON.stringify(statusData), 'EX', 86400);

        if(teamId){
            const teamJobsKey = `team:${teamId}:jobs`;
            await this.redisClient.sadd(teamJobsKey, jobId);
        }

        await this.emitJobUpdate(teamId, statusData);
    }

    private async emitJobUpdate(teamId: string, jobData: any): Promise<void> {
        if(!teamId) return;
        const { emitJobUpdate } = await import('@/config/socket');
        await emitJobUpdate(teamId, jobData);
    }

    async getJobStatus(jobId: string): Promise<any | null>{
        const statusKey = `${this.statusKeyPrefix}${jobId}`;
        try{
            const statusData = await this.redisClient.get(statusKey);
            if(!statusData){
                return null;
            }

            return JSON.parse(statusData);
        }catch(error){
            console.error(`[${this.queueName}] Failed to get status for job ${jobId}:`, error);
            return null;
        }
    }
}