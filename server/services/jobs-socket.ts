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

import http from 'http';
import { Server, Socket } from 'socket.io';

import Redis from 'ioredis';
import { createRedisClient, redis } from '@config/redis';
import { getTrajectoryProcessingQueue, getAnalysisQueue } from '@/queues';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { ClientData, ProcessingQueue } from '@/types/config/socket';
import { createAdapter } from '@socket.io/redis-adapter';
import { publishJobUpdate } from '@/events/job-updates';
import trajectorySocketService from './trajectory-socket';

type QueueName = 'trajectory' | 'analysis';

const JOB_UPDATES_CHANNEL = 'job_updates';

/**
 * Singleton service that encapsulates SocketIO initialization and operation
 * with Redis adapter and Pub/Sub support for multi-process/multi-pod deployments.
 */
class JobsSocketService{
    /**
     * SocketIO instance bound to the provided HTTP server.
     * Set after `initialize()`.
     */
    private io?: Server;

    /**
     * Idempotence guard for initialization.
     */
    private initialized = false;

    /**
     * Per-process buffer of clients that are currently performing their initial load.
     * While a socket is initializing (fetching initial jobs), updates for that team
     * are temporarily buffered and flushed once the init finishes.
     */
    private initializingClients = new Map<string, ClientData>();

    /**
     * Redis connections used by the SocketIO adapter (fanout across pods).
     * @see {@link createAdapter}
     */
    private adapterPub?: Redis;
    private adapterSub?: Redis;

    /**
     * Redis subscriber used to receive domain events (Pub/Sub).
     * Workers publish to `job_updates`, and this service re-emits locally.
     */
    private domainSub?: Redis;

    /**
     * @param corsOrigins Allowed origins for SocketIO CORS.
     * @param pingTimeout Time (ms) before a client is considered disconnected.
     * @param pingInterval Interval (ms) between keep-alive pings.
     */
    constructor(
        private corsOrigins: string[] = [
        process.env.CLIENT_DEV_HOST as string,
        process.env.CLIENT_HOST as string
        ],
        private pingTimeout = 60_000,
        private pingInterval = 25_000
    ){}  

    /**
     * Initializes SocketIO on the provided HTTP server, attaches the Redis adapter
     * for multi-node support, and subscribes to the domain Pub/Sub channel.
     * 
     * @param server HTTP server to attach SocketIO to.
     * @returns The `Server` (SocketIO) instance.
     */
    async initialize(server: http.Server): Promise<Server>{
        if(this.initialized && this.io){
            return this.io;
        }

        this.io = new Server(server, {
            cors: {
                origin: this.corsOrigins.filter(Boolean),
                methods: ['GET', 'POST']
            },
            transports: ['websocket', 'polling'],
            pingTimeout: this.pingTimeout,
            pingInterval: this.pingInterval
        });

        this.adapterPub = createRedisClient();
        this.adapterSub = createRedisClient();
        this.io.adapter(createAdapter(this.adapterPub, this.adapterSub));

        this.domainSub = createRedisClient();
        this.domainSub.on('message', async (channel, raw) => {
            if(channel !== JOB_UPDATES_CHANNEL) return;
            try{
                const { teamId, payload } = JSON.parse(raw);
                await this.handleExternalJobUpdate(teamId, payload);
            }catch(err: any){
                console.error('[JobSocketService] Invalid pub/sub message:', err);
            }
        });

        await this.domainSub.subscribe(JOB_UPDATES_CHANNEL);

        this.io.on('connection', (socket) => this.onConnection(socket));
        trajectorySocketService.initialize(this.io);
        this.initialized = true;
        return this.io;
    }

    /**
     * Publishes a job update onto the domain bus so that ALL instances
     * receive it and re-emit to their local clients.
     * 
     * @param teamId Team identifier (mapped to room `team-<id>`).
     * @param jobData Arbitrary update payload for the job.
     * 
     * @remarks
     * - Delegates to the shared publisher `publishJobUpdate` to avoid duplicate connections.
     * - No-op if `teamId` or `jobData` are falsy.
     */
    async emitJobUpdate(teamId: string, jobData: any): Promise<void>{
        if(!teamId || !jobData) return;
        await publishJobUpdate(teamId, jobData);
    }

    /**
     * Closes SocketIO and the Redis connections associated with this service.
     * Use for graceful shutdown (SIGTERM/SIGNINT). 
     */
    async close(): Promise<void>{
        try{
            await new Promise<void>((res) => {
                if(this.io){
                    this.io.close(() => res());
                }else{
                    res();
                }
            });
        }catch{}

        try{
            await this.adapterPub?.quit();
        }catch{}

        try{
            await this.adapterSub?.quit();
        }catch{}

        try{
            if(this.domainSub){
                await this.domainSub.unsubscribe(JOB_UPDATES_CHANNEL).catch(() => {});
                await this.domainSub.quit();
            }
        }catch{}

        this.initialized = false;
        this.initializingClients.clear();
        this.io = undefined;
        this.adapterPub = undefined;
        this.adapterSub = undefined;
        this.domainSub = undefined;
    }

    /**
     * Returns the initialized SocketIO server.
     * @throws If SocketIO has not been initialized yet.
     */
    getIO(): Server{
        if(!this.io){
            throw new Error('Socket.io not initialized!');
        }
        return this.io;
    }

    /**
     * Socket connection handler.
     * 
     * @param socket The connected socket.
     */
    private onConnection(socket: Socket){
        console.log(`[Socket] User connected: ${socket.id}`);

        socket.on('subscribe_to_team', async ({ teamId, previousTeamId }) => {
            // TODO: AUTH!!!!!
            if(previousTeamId){
                socket.leave(`team-${previousTeamId}`);
                console.log(`[Socket] Socket ${socket.id} left room: team-${previousTeamId}`);
            }

            this.initializingClients.delete(socket.id);
            if(!teamId){
                return;
            }

            this.initializingClients.set(socket.id, {
                teamId,
                initStartTime: Date.now(),
                pendingUpdates: []
            });

            console.log(`[Socket] Starting init for ${socket.id} (team ${teamId})`);
            socket.join(`team-${teamId}`);
            
            const initialJobs = await this.getJobsForTeam(teamId);
            socket.emit('team_jobs', initialJobs);
            console.log(`[Socket] Init completed for ${socket.id}: ${initialJobs.length} jobs`);

            setImmediate(async () => {
                await this.sendPendingUpdates(socket.id);
                this.initializingClients.delete(socket.id);
                console.log(`[Socket] Background updates completed for ${socket.id}`);
            });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${socket.id}`);
            this.initializingClients.delete(socket.id);
        });
    }

    /**
     * Handles a job update received via Redis Pub/Sub and re-emits to local sockets.
     * 
     * @param teamId Team identifier for routing to the correct room.
     * @param jobData Update payload as published by workers/queues.
     * 
     * @remarks
     * - If there are sockets for the same currently initializing in THIS process,
     * the update is buffered and sent after their snapshopt completes.
     */
    private async handleExternalJobUpdate(teamId: string, jobData: any){
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
};

const jobsSockets = new JobsSocketService();

export default jobsSockets;