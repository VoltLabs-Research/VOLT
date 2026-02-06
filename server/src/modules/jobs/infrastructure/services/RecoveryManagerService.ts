import { injectable, inject } from 'tsyringe';
import Job, { JobStatus } from '@modules/jobs/domain/entities/Job';
import { IRecoveryManagerService } from '@modules/jobs/domain/ports/IRecoveryManagerService';
import { IJobRepository } from '@modules/jobs/domain/ports/IJobRepository';
import { setImmediate } from 'node:timers/promises';
import { JOBS_TOKENS } from '@modules/jobs/infrastructure/di/JobsTokens';

export interface RecoveryManagerConfig{
    queueKey: string;
    processingKey: string;
    statusKeyPrefix: string;
    startupLockTTLMs: number;
    ttlSeconds: number;
};

export interface JobDeserializer<T extends Job>{
    (rawData: string): T;
};

@injectable()
export default class RecoveryManagerService implements IRecoveryManagerService{
    private config!: RecoveryManagerConfig;
    private deserializeJob!: JobDeserializer<Job>;

    constructor(
        @inject(JOBS_TOKENS.JobRepository)
        private readonly jobRepository: IJobRepository
    ){}

    initialize(config: RecoveryManagerConfig, deserializeJob: JobDeserializer<Job>): void{
        this.config = config,
        this.deserializeJob = deserializeJob;
    }


    async withStartupLock<R>(fn: () => Promise<R>): Promise<R | undefined> {
        const lockKey = `${this.config.queueKey}:startup_lock`;
        const ttlMs = this.config.startupLockTTLMs;
        const lockVal = `${process.pid}:${Date.now()}`;

        const lua = `
            local ok = redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX')
            if ok then return 1 else return 0 end
        `;

        const acquired = await this.jobRepository.evalScript(lua, 1, lockKey, lockVal, String(ttlMs)) as number;
        if(acquired !== 1){
            return;
        }

        try{
            return await fn();
        }finally{
            await this.jobRepository.delete(lockKey).catch(() => { });
        }
    }

    async drainProcessingIntoQueue(): Promise<number> {
        const lua = `
            local src = KEYS[1]
            local dst = KEYS[2]
            local moved = 0
            while true do
                local v = redis.call('RPOPLPUSH', src, dst)
                if not v then break end
                moved = moved + 1
            end
            return moved
        `;
        
        const moved = await this.jobRepository.evalScript(
            lua,
            2,
            this.config.processingKey,
            this.config.queueKey
        ) as number;

        return moved || 0;
    }

    async requeueStaleRunningJobs(): Promise<void>{
        let cursor = '0';
        const match = `${this.config.statusKeyPrefix}*`;

        const asyncForEach = async<T>(
            items: T[],
            batchSize: number,
            callback: (item: T) => Promise<void>
        ): Promise<void> => {
            for(let i = 0; i < items.length; i += batchSize){
                const batch = items.slice(i, i + batchSize);
                await Promise.all(batch.map(callback));
            }
        };

        do{
            const [newCursor, keys] = await this.jobRepository.scan(cursor, match, 500);
            cursor = newCursor;

            if(keys.length === 0) continue;

            const pipeline = this.jobRepository.pipeline();
            keys.forEach((key) => pipeline.get(key));

            const results: any = await pipeline.exec();

            await asyncForEach(results, 100, async (item: unknown) => {
                const [_, raw] = item as [any, any];
                if(!raw) return;

                try{
                    const data = JSON.parse(raw);
                    if(data?.status !== JobStatus.Running) return;

                    const jobObj = this.deserializeJob(JSON.stringify(data));
                    const rawData = JSON.stringify(jobObj);

                    const [inQueue, inProc] = await Promise.all([
                        this.jobRepository.evalScript(
                            'return redis.call("LPOS", KEYS[1], ARGV[1])', 
                            1, 
                            this.config.queueKey, 
                            rawData
                        ),
                        this.jobRepository.evalScript(
                            'return redis.call("LPOS", KEYS[1], ARGV[1])', 
                            1, 
                            this.config.processingKey, 
                            rawData
                        )
                    ]);

                    if(inQueue === null && inProc === null){
                        await this.jobRepository.addToQueue(this.config.queueKey, [rawData]);
                    }

                    const statusKey = `${this.config.statusKeyPrefix}${data.jobId}`;
                    const statusData = {
                        ...data,
                        status: JobStatus.Queued
                    };
                    await this.jobRepository.setJobStatus(statusKey, statusData, this.config.ttlSeconds);
                }catch(e){
                    // Ignore parse errors
                }
            });

            await setImmediate();
        }while(cursor !== '0');
    }

    async recoverOnStartup(): Promise<void>{
        await this.withStartupLock(async () => {
            await this.drainProcessingIntoQueue();
            await this.requeueStaleRunningJobs();
        });
    }
};