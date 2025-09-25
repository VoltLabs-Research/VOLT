import { Server, Socket } from 'socket.io';
import { publishJobUpdate } from '@/events/job-updates';
import { redis } from '@config/redis';
import { getTrajectoryProcessingQueue, getAnalysisQueue } from '@/queues';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { ClientData, ProcessingQueue } from '@/types/config/socket';
import BaseSocketModule from '@/socket/base-socket-module';

/**
 * Jobs feature module:
 *  - Handles team subscription flow with initial snapshot + buffered updates.
 *  - Provides a public API to emit job updates onto the domain bus.
 */
class JobsModule extends BaseSocketModule{
    private io?: Server;

    // Local buffer while a client is doing initial fetch
    private initializingClients = new Map<string, ClientData>();

    constructor(){
        super('JobsModule');
    }

    onInit(io: Server): void{
        this.io = io;
    }

    onConnection(socket: Socket): void{
        socket.on('subscribe_to_team', async ({ teamId, previousTeamId }) => {
            if(previousTeamId){
                this.leaveRoom(socket, `team-${previousTeamId}`);
            }

            this.initializingClients.delete(socket.id);
            if(!teamId) return;

            this.initializingClients.set(socket.id, {
                teamId,
                initStartTime: Date.now(),
                pendingUpdates: []
            });

            this.joinRoom(socket, `team-${teamId}`);

            const jobs = await this.getJobsForTeam(teamId);
            socket.emit('team_jobs', jobs);

            setImmediate(async () => {
                await this.sendPendingUpdates(socket.id);
                this.initializingClients.delete(socket.id);
            });
        });

        socket.on('disconnect', () => {
            this.initializingClients.delete(socket.id);
        });
    }

    /**
     * Publish a job update to the domain bus (all pods receive it).
     */
    async emitJobUpdate(teamId: string, payload: any): Promise<void>{
        if(!teamId || !payload) return;
        await publishJobUpdate(teamId, payload);
    }

    /**
     * Re-emit a job update to local sockets (called by whoever listens to Pub/Sub).
     */
    async reemitLocal(teamId: string, jobData: any): Promise<void>{
        if(!this.io){
            return;
        }

        const update = this.normalizeUpdate(jobData);
        if(this.hasAnyInitializingForTeam(teamId)){
            this.addPendingUpdate(teamId, update);
            return;
        }

        const sockets = await this.io.in(`team-${teamId}`).fetchSockets();
        const ready = sockets.filter((socket) => !this.initializingClients.has(socket.id));
        if(ready.length === 0){
            this.addPendingUpdate(teamId, update);
            return;
        }

        ready.forEach((socket) => socket.emit('job_update', update));
    }

    /**
     * Checks if any socket for the given team is currently initializing on this instance.
     * 
     * @param teamId Team identifier.
     * @returns `true` if at least one socket is initializing; otherwise `false`.
     */
    private hasAnyInitializingForTeam(teamId: string): boolean{
        for(const client of this.initializingClients.values()){
            if(client.teamId === teamId){
                return true;
            }
        }

        return false;
    }

    /**
     * Adds an update to the pending buffer for all sockets initializing for the given team.
     * 
     * @param teamId Team identifier.
     * @param jobData Update payload to buffer.
     * 
     * @remarks
     * - Caps buffer per socket at 1000 entries, trimming to the last 50 if exceeded.
     */
    private addPendingUpdate(teamId: string, jobData: any): void{
        for(const client of this.initializingClients.values()){
            if(client.teamId !== teamId) continue;

            client.pendingUpdates.push(jobData);
            if(client.pendingUpdates.length > 1000){
                client.pendingUpdates = client.pendingUpdates.slice(-50);
            }
        }
    }

    /**
     * Sends buffered updates for a given socket and clears its buffer.
     * 
     * @param socketId Socket identifier
     */
    private async sendPendingUpdates(socketId: string): Promise<void>{
        if(!this.io) return;

        const client = this.initializingClients.get(socketId);
        if(!client || client.pendingUpdates.length === 0) return;

        const socket = this.io.sockets.sockets.get(socketId);
        if(!socket) return;

        const batchSize = 10;
        for(let i  = 0; i < client.pendingUpdates.length; i += batchSize){
            client.pendingUpdates.slice(i, i + batchSize).forEach((update) => socket.emit('job_update', update));
            if(i + batchSize < client.pendingUpdates.length){
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
        }

        client.pendingUpdates.length = 0;
    }

    /**
     * Returns all processing queues that should contribute to the initial snapshopt.
     * TODO: ADD HEADLESS RASTERIZER QUEUE!
     */
    private getAllProcessingQueues(): ProcessingQueue[] {
        return [
            { name: 'trajectory', queue: getTrajectoryProcessingQueue() },
            { name: 'analysis', queue: getAnalysisQueue() }
        ];
    }

    /**
     * Fetches the latest job states for the given team from Redis, merging across queues.
     * Uses pipelining to minimize round-trips.
     * 
     * @param teamId Team identifier.
     * @returns Array of unique jobs (deduplicated by `jobId`, newest timestamp wins).
     */
    private async getJobsForTeam(teamId: string): Promise<BaseJob[]>{
        if(!teamId) return [];
        const startTime = Date.now();
        console.log(`[Socket] Fetching fresh jobs for team ${teamId}...`);

        const allQueues = this.getAllProcessingQueues();
        const teamJobsKey = `team:${teamId}:jobs`;
        const jobIds = await redis?.smembers(teamJobsKey);

        if(!jobIds?.length){
            console.log(`[Socket] No jobs found in team index for team ${teamId}`);
            return [];   
        }

        const queueResults = await Promise.all(allQueues.map(async ({ name, queue }) => {
            const statusKeys = jobIds.map((id) => `${queue.queueKey}:status:${id}`);
            const batchSize = 500;
            const jobs: BaseJob[] = [];

            for(let i = 0; i < statusKeys.length; i += batchSize){
                const batchKeys = statusKeys.slice(i, i + batchSize);

                const pipeline = redis?.pipeline();
                batchKeys.forEach((k) => pipeline?.get(k));
                const results = (await pipeline?.exec()) || [];

                for(const [_, value] of results){
                    if(!value) continue;

                    const data = JSON.parse(value);
                    if(data.teamId !== teamId) continue;

                    jobs.push({
                        jobId: data.jobId,
                        status: data.status,
                        progress: data.progress || 0,
                        queueType: name as QueueName,
                        timestamp: data.timestamp,
                        ...data
                    });
                }
            }

            console.log(`[Socket] Found ${jobs.length} jobs in ${name} queue for team ${teamId}`);
            return jobs;
        }));

        const jobMap = new Map<string, BaseJob>();
        for(const job of queueResults.flat()){
            const prev = jobMap.get(job.jobId);
            const tNew = job.timestamp ? new Date(job.timestamp).getTime() : 0;
            const tPrev = prev?.timestamp ? new Date(prev.timestamp).getTime() : 0;
            if(!prev || tNew > tPrev) jobMap.set(job.jobId, job);
        }

        const uniqueJobs = Array.from(jobMap.values()).sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return tb - ta;  
        });

        console.log(`[Socket] Fresh fetch completed for team ${teamId}: ${uniqueJobs.length} jobs in ${Date.now() - startTime}ms`);
        return uniqueJobs;
    }

    /**
     * Normalizes arbitrary job update paylaods to a stable shape for the client.
     * 
     * @param jobData Raw job data as received from workers/queues.
     * @returns Normalized job update object.
     */
    private normalizeUpdate(jobData: any) {
        return {
            jobId: jobData.jobId,
            status: jobData.status,
            progress: jobData.progress || 0,
            chunkIndex: jobData.chunkIndex,
            totalChunks: jobData.totalChunks,
            name: jobData.name,
            message: jobData.message,
            trajectoryId: jobData.trajectoryId,
            sessionId: jobData.sessionId,
            sessionStartTime: jobData.sessionStartTime,
            timestamp: jobData.timestamp || new Date().toISOString(),
            queueType: jobData.queueType || 'unknown',
            type: jobData.type,
            ...(jobData.error && { error: jobData.error }),
            ...(jobData.result && { result: jobData.result }),
            ...(jobData.processingTimeMs && { processingTimeMs: jobData.processingTimeMs })
        };
    }
}

export default JobsModule;