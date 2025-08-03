/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import IORedis from 'ioredis';
import { BaseJob } from '@/types/queues/base-processing-queue';

export class SessionManager<T extends BaseJob> {
    private sessionsBeingCleaned = new Set<string>();

    constructor(
        private redis: IORedis,
        private statusKeyPrefix: string,
        private emitSessionExpired: (teamId: string, sessionId: string, trajectoryId: string) => void
    ){}

    async checkAndCleanupSession(job: T): Promise<void> {
        const sessionId = (job as any).sessionId;
        const trajectoryId = (job as any).trajectoryId;
        
        if(!sessionId || !trajectoryId) return;
        if(this.sessionsBeingCleaned.has(sessionId)) return;

        console.log(`Checking session completion for ${sessionId}`);

        try{
            const result = await this.executeCleanupScript(sessionId, trajectoryId, job.teamId);
            const [shouldClean, count, status] = result;

            if(shouldClean === 1){
                this.sessionsBeingCleaned.add(sessionId);
                console.log(`Session ${sessionId} CLEANED! Deleted ${count} jobs`);
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
            local teamId = ARGV[3]
            local statusKeyPrefix = ARGV[4]
            
            local sessionKey = "session:" .. sessionId
            local counterKey = sessionKey .. ":remaining"
            local teamJobsKey = "team:" .. teamId .. ":jobs"
            
            local remaining = redis.call('DECR', counterKey)
            
            if remaining <= 0 then
                local sessionData = redis.call('GET', sessionKey)
                if not sessionData then
                    return {0, 0, "no_session"}
                end
                
                local allJobIds = redis.call('SMEMBERS', teamJobsKey)
                local sessionJobIds = {}
                
                for i = 1, #allJobIds do
                    local jobStatusKey = statusKeyPrefix .. allJobIds[i]
                    local jobStatusData = redis.call('GET', jobStatusKey)
                    
                    if jobStatusData then
                        local jobStatus = cjson.decode(jobStatusData)
                        if jobStatus.sessionId == sessionId and jobStatus.trajectoryId == trajectoryId then
                            table.insert(sessionJobIds, allJobIds[i])
                        end
                    end
                end
                
                redis.call('DEL', sessionKey)
                redis.call('DEL', counterKey)
                
                for i = 1, #sessionJobIds do
                    redis.call('DEL', statusKeyPrefix .. sessionJobIds[i])
                    redis.call('SREM', teamJobsKey, sessionJobIds[i])
                end
                
                return {1, #sessionJobIds, "cleaned"}
            else
                return {0, remaining, "pending"}
            end
        `;

        return await this.redis.eval(
            luaScript, 
            0, 
            sessionId, 
            trajectoryId, 
            teamId, 
            this.statusKeyPrefix
        ) as [number, number, string];
    }
}