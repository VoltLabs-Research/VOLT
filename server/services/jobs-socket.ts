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

type QueueName = 'trajectory' | 'analysis';

const JOB_UPDATES_CHANNEL = 'job_updates';

class JobsSocketService{
    private io?: Server;
    private initialized = false;

    // Local clients buffer
    private initializingClients = new Map<string, ClientData>();

    // Redis adapter for SocketIO
    private adapterPub?: Redis;
    private adapterSub?: Redis;

    private domainSub?: Redis;

    constructor(
        private corsOrigins: string[] = [
        process.env.CLIENT_DEV_HOST as string,
        process.env.CLIENT_HOST as string
        ],
        private pingTimeout = 60_000,
        private pingInterval = 25_000
    ){}  

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
        this.initialized = true;
        return this.io;
    }

    async emitJobUpdate(teamId: string, jobData: any): Promise<void>{
        if(!teamId || !jobData) return;
        await publishJobUpdate(teamId, jobData);
    }

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

    getIO(): Server{
        if(!this.io){
            throw new Error('Socket.io not initialized!');
        }
        return this.io;
    }

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

    private hasAnyInitializingForTeam(teamId: string): boolean{
        for(const client of this.initializingClients.values()){
            if(client.teamId === teamId){
                return true;
            }
        }

        return false;
    }

    private addPendingUpdate(teamId: string, jobData: any): void{
        for(const client of this.initializingClients.values()){
            if(client.teamId !== teamId) continue;

            client.pendingUpdates.push(jobData);
            if(client.pendingUpdates.length > 1000){
                client.pendingUpdates = client.pendingUpdates.slice(-50);
            }
        }
    }

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

    private getAllProcessingQueues(): ProcessingQueue[] {
        return [
            { name: 'trajectory', queue: getTrajectoryProcessingQueue() },
            { name: 'analysis', queue: getAnalysisQueue() }
        ];
    }

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