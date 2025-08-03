import { Server } from 'socket.io';
import { redis } from '@config/redis';
import { getTrajectoryProcessingQueue, getAnalysisQueue } from '@/queues';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { ClientData, ProcessingQueue } from '@/types/config/socket';
import http from 'http';

let io: Server;

let initializingClients = new Map<string, ClientData>();

const addPendingUpdate = (teamId: string, jobData: any): void => {
    for(const client of initializingClients.values()){
        if(client.teamId === teamId){
            client.pendingUpdates.push(jobData);
            if(client.pendingUpdates.length > 1000){
                client.pendingUpdates = client.pendingUpdates.slice(-50);
            }
        }
    }
};

const sendPendingUpdates = async (socketId: string): Promise<void> => {
    const client = initializingClients.get(socketId);
    if(!client || client.pendingUpdates.length === 0) return;

    console.log(`[Socket] Sending ${client.pendingUpdates.length} pending updates to socket ${socketId}`);
    const socket = io.sockets.sockets.get(socketId);
    if(!socket) return;

    // TODO: adaptive?
    const batchSize = 10;
    for(let i = 0; i < client.pendingUpdates.length; i += batchSize){
        client.pendingUpdates
            .slice(i, i + batchSize)
            .forEach((update) => socket.emit('job_update', update));
        if(i + batchSize < client.pendingUpdates.length){
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
    }

    console.log(`[Socket] Sent ${client.pendingUpdates.length} pending updates to socket ${socketId}`);
};

const getAllProcessingQueues = (): ProcessingQueue[] => {
    return [
        { name: 'trajectory', queue: getTrajectoryProcessingQueue() },
        { name: 'analysis',   queue: getAnalysisQueue() }
    ]; 
};

const getJobsForTeam = async (teamId: string): Promise<BaseJob[]> | [] => {
    if(!teamId) return [];
    const startTime = Date.now();
    console.log(`[Socket] Fetching fresh jobs for team ${teamId}...`);

    const allQueues = getAllProcessingQueues();
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
            const batchValues = await redis?.mget(...batchKeys);
            if(!batchValues) continue;
            batchValues.forEach((value) => {
                if(!value) return;
                const data = JSON.parse(value);
                if(data.teamId === teamId){
                    jobs.push({
                        jobId: data.jobId,
                        status: data.status,
                        progress: data.progress || 0,
                        queueType: name,
                        timestamp: data.timestamp,
                        ...data
                    });
                }
            });
        }

        console.log(`[Socket] Found ${jobs.length} jobs in ${name} queue for team ${teamId}`);
        return jobs;
    }));

    const allJobs = queueResults.flat();
    const jobMap = new Map<string, BaseJob>();
    for(const job of allJobs){
        const existing = jobMap.get(job.jobId);
        if(!existing || (job.timestamp && new Date(job.timestamp) > new Date(existing.timestamp || 0))){
            jobMap.set(job.jobId, job);
        }
    }

    const uniqueJobs = Array.from(jobMap.values()).sort((a, b) => {
        if(!a.timestamp) return 1;
        if(!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    console.log(`[Socket] Fresh fetch completed for team ${teamId}: ${uniqueJobs.length} jobs in ${Date.now() - startTime}ms`);
    return uniqueJobs;
};

const cleanupOldJobs = async (teamId: string): Promise<void> => {
    if(Math.random() > 0.1){
        console.log(`[Socket] Skipping cleanup for team ${teamId} (probability)`);
        return;
    }

    console.log(`[Socket] Quick cleanup for team ${teamId}...`);
    const teamJobsKey = `team:${teamId}:jobs`;
    const jobIds = await redis?.smembers(teamJobsKey);
    if(!jobIds?.length) return;

    const sampleIds = jobIds.slice(0, 100);
    const allQueues = getAllProcessingQueues();
    const toRemove: string[] = [];
    for(const { queue } of allQueues){
        const keys = sampleIds.map((id) => `${queue.queueKey}:status:${id}`);
        const values = await redis?.mget(...keys);
        values?.forEach((value, idx) => {
            if(!value && !toRemove.includes(sampleIds[idx])){
                toRemove.push(sampleIds[idx]);
            }
        });
    }

    if(toRemove.length){
        await redis?.srem(teamJobsKey, ...toRemove);
        console.log(`[Socket] Removed ${toRemove.length} stale jobs from team ${teamId}`);
    }
};

export const initializeSocketIO = (server: http.Server): Server => {
    io = new Server(server, {
        cors: {
            // TODO: use NODE_ENV
            origin: [process.env.CLIENT_DEV_HOST as string, process.env.CLIENT_HOST as string],
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] User connected: ${socket.id}`);

        socket.on('subscribe_to_team', async ({ teamId, previousTeamId }) => {
            if(previousTeamId){
                socket.leave(`team-${previousTeamId}`);
                console.log(`[Socket] Socket ${socket.id} left room: team-${previousTeamId}`);   
            }

            initializingClients.delete(socket.id);
            if(!teamId) return;

            initializingClients.set(socket.id, {
                teamId,
                initStartTime: Date.now(),
                pendingUpdates: []
            });

            console.log(`[Socket] Starting init for ${socket.id} (team ${teamId})`);
            socket.join(`team-${teamId}`);
            setImmediate(() => cleanupOldJobs(teamId));

            const initialJobs = await getJobsForTeam(teamId);
            socket.emit('team_jobs', initialJobs);
            console.log(`[Socket] Init completed for ${socket.id}: ${initialJobs.length} jobs`);

            setImmediate(async () => {
                await sendPendingUpdates(socket.id);
                initializingClients.delete(socket.id);
                console.log(`[Socket] Background updates completed for ${socket.id}`);
            });
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${socket.id}`);
            initializingClients.delete(socket.id);
        });
    });

    return io;
};

export const emitJobUpdate = async (teamId: string, jobData: any): Promise<void> => {
    if(!teamId || !jobData || !io) return;

    // TODO: this is ugly
    const update = {
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

    const hasInit = Array.from(initializingClients.values()).some((c) => c.teamId === teamId);
    if(hasInit){
        addPendingUpdate(teamId, update);
        return;
    }

    const sockets = await io.in(`team-${teamId}`).fetchSockets();
    const ready = sockets.filter((socket) => !initializingClients.has(socket.id));
    if(!ready.length){
        addPendingUpdate(teamId, update);
        return;
    }

    ready.forEach((s) => s.emit('job_update', update));
    if(jobData.type === 'session_expired'){
        console.log(`[Socket] Emitted session_expired to ${ready.length} clients for team ${teamId}`);
    }else{
        console.log(`[Socket] Emitted job_update to ${ready.length} clients for team ${teamId} (job ${update.jobId})`);
    }
};

export const getIO = (): Server => {
    if(!io){
        throw new Error('Socket.io not initialized!');
    }
    return io;
};