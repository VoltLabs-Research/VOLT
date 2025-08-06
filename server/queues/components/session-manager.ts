import IORedis from 'ioredis';
import { BaseJob } from '@/types/queues/base-processing-queue';

export class SessionManager<T extends BaseJob> {
    private sessionsBeingCleaned = new Set<string>();

    constructor(
        private redis: IORedis,
        private emitSessionExpired: (teamId: string, sessionId: string, trajectoryId: string) => void
    ){}

    async checkAndCleanupSession(job: T): Promise<void> {
        const sessionId = (job as any).sessionId;
        const trajectoryId = (job as any).trajectoryId;
        
        if(!sessionId || !trajectoryId) return;
        if(this.sessionsBeingCleaned.has(sessionId)) return;

        try{
            const result = await this.executeCleanupScript(sessionId, trajectoryId, job.teamId);
            const [shouldClean] = result;

            if(shouldClean === 1){
                this.sessionsBeingCleaned.add(sessionId);
                this.emitSessionExpired(job.teamId, sessionId, trajectoryId);
                
                setTimeout(() => {
                    this.sessionsBeingCleaned.delete(sessionId);
                }, 10000);
            }
        }catch(error){
            console.error(`Error checking session ${sessionId}:`, error);
            this.sessionsBeingCleaned.delete(sessionId);
        }
    }

    async initializeSession(sessionId: string, sessionStartTime: string, jobCount: number, firstJob: T): Promise<void> {
        const sessionKey = `session:${sessionId}`;
        const counterKey = `session:${sessionId}:remaining`;
        
        await this.redis.pipeline()
            .setex(sessionKey, 86400 * 7, JSON.stringify({
                sessionId,
                startTime: sessionStartTime,
                totalJobs: jobCount,
                trajectoryId: (firstJob as any).trajectoryId,
                teamId: firstJob.teamId,
                status: 'active'
            }))
            .set(counterKey, jobCount.toString())
            .expire(counterKey, 86400 * 7)
            .exec();
    }

    generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private async executeCleanupScript(sessionId: string, trajectoryId: string, teamId: string): Promise<[number, number, string]> {
        const luaScript = `
            local sessionId = ARGV[1]
            local trajectoryId = ARGV[2]
            
            local sessionKey = "session:" .. sessionId
            local counterKey = sessionKey .. ":remaining"
            
            local remaining = redis.call('DECR', counterKey)
            
            if remaining <= 0 then
                redis.call('DEL', sessionKey)
                redis.call('DEL', counterKey)
                
                return {1, 0, "cleaned"}
            else
                return {0, remaining, "pending"}
            end
        `;

        return await this.redis.eval(
            luaScript, 
            0, 
            sessionId, 
            trajectoryId
        ) as [number, number, string];
    }
}