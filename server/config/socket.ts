import { Server } from 'socket.io';
import { initializeRedis, redis } from '@config/redis';
import { getTrajectoryProcessingQueue, getAnalysisQueue } from '@/queues';
import http from 'http';

let io: Server;

const initializingClients = new Map<string, {
    teamId: string,
    initStartTime: number,
    pendingUpdates: any[]
}>();

const addPendingUpdate = (teamId: string, jobData: any): void => {
    for(const [socketId, clientData] of initializingClients.entries()){
        if(clientData.teamId === teamId){
            clientData.pendingUpdates.push(jobData);
            if(clientData.pendingUpdates.length > 1000){
                clientData.pendingUpdates = clientData.pendingUpdates.slice(-50);
            }
        }
    }
};

const sendPendingUpdates = async (socketId: string): Promise<void> => {
    const clientData = initializingClients.get(socketId);
    if(!clientData || clientData.pendingUpdates.length === 0) return;
    
    console.log(`[Socket] Sending ${clientData.pendingUpdates.length} pending updates to socket ${socketId}`);
    
    const socket = io.sockets.sockets.get(socketId);
    if(!socket) return;

    const batchSize = 10;
    for(let i = 0; i < clientData.pendingUpdates.length; i += batchSize){
        const batch = clientData.pendingUpdates.slice(i, i + batchSize);
        batch.forEach((update) => socket.emit('job_update', update));
        // Small pause between batches to avoid overloading
        if(i + batchSize < clientData.pendingUpdates.length){
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    console.log(`[Socket] Sent ${clientData.pendingUpdates.length} pending updates to socket ${socketId}`);
};

const getAllProcessingQueues = () => {
    const queues = [];
    queues.push({
        name: 'trajectory',
        queue: getTrajectoryProcessingQueue()
    });

    queues.push({
        name: 'analysis',
        queue: getAnalysisQueue()
    });

    return queues;
};

const getJobsForTeam = async (teamId: string): Promise<any[]> => {
    if(!teamId) return [];

    const startTime = Date.now();
    console.log(`[Socket] Fetching fresh jobs for team ${teamId}...`);

    const allQueues = getAllProcessingQueues();
    const teamJobsKey = `team:${teamId}:jobs`;
    const jobIds = await redis?.smembers(teamJobsKey);

    if(!jobIds || jobIds.length === 0){
        console.log(`[Socket] No jobs found in team index for team ${teamId}`);
        return [];
    }

    console.log(`[Socket] Found ${jobIds.length} jobs in team index for team ${teamId}`);

    const queuePromises = allQueues.map(async ({ name: queueName, queue }) => {
        const statusKeys = jobIds.map((jobId) => `${queue.queueKey}:status:${jobId}`);
        const batchSize = 500;
        const jobs = [];
        
        for(let i = 0; i < statusKeys.length; i += batchSize){
            const batch = statusKeys.slice(i, i + batchSize);
            const batchJobIds = jobIds.slice(i, i + batchSize);
            const statusValues = await redis?.mget(...batch);
            if(!statusValues) continue;

            for(let j = 0; j < statusValues.length; j++){
                const statusString = statusValues[j];
                if(!statusString) continue;
                const jobStatus = JSON.parse(statusString);
                if(jobStatus.teamId === teamId){
                    jobs.push({
                        jobId: jobStatus.jobId,
                        status: jobStatus.status,
                        progress: jobStatus.progress || 0,
                        chunkIndex: jobStatus.chunkIndex,
                        totalChunks: jobStatus.totalChunks,
                        name: jobStatus.name,
                        message: jobStatus.message,
                        timestamp: jobStatus.timestamp,
                        queueType: queueName,
                        ...(jobStatus.error && { error: jobStatus.error }),
                        ...(jobStatus.result && { result: jobStatus.result }),
                        ...(jobStatus.processingTimeMs && { processingTimeMs: jobStatus.processingTimeMs })
                    });
                }
            }

            console.log(`[Socket] Found ${jobs.length} jobs in ${queueName} queue for team ${teamId}`);
            return jobs;
        }
    });

    const queueResults = await Promise.all(queuePromises);
    const allJobsWithData = queueResults.flat();
    
    const jobMap = new Map();
    for(const job of allJobsWithData){
        const existing = jobMap.get(job.jobId);
        if(!existing || (job.timestamp && new Date(job.timestamp) > new Date(existing.timestamp))){
            jobMap.set(job.jobId, job);
        }
    }

    const uniqueJobs = Array.from(jobMap.values());

    uniqueJobs.sort((a, b) => {
        if(!a.timestamp && !b.timestamp) return 0;
        if(!a.timestamp) return 1;
        if(!b.timestamp) return -1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`[Socket] Fresh fetch completed for team ${teamId}: ${uniqueJobs.length} jobs in ${duration}ms`);

    return uniqueJobs;
};

const cleanupOldJobs = async (teamId: string): Promise<void> => {
    // Only clean occasionally to reduce latency
    if(Math.random() > 0.1){
        console.log(`[Socket] Skipping cleanup for team ${teamId} (probability)`);
        return;
    }

    console.log(`[Socket] Quick cleanup for team ${teamId}...`);
    
    const teamJobsKey = `team:${teamId}:jobs`;
    const jobIds = await redis?.smembers(teamJobsKey);
        
    if(!jobIds || jobIds.length === 0) return;

    const sampleSize = Math.min(100, jobIds.length);
    const sampleIds = jobIds.slice(0, sampleSize);
        
    const allQueues = getAllProcessingQueues();
    const jobsToRemove: string[] = [];

    for(const { queue } of allQueues){
        const statusKeys = sampleIds.map(jobId => `${queue.queueKey}:status:${jobId}`);
        const statusValues = await redis?.mget(...statusKeys);

        if(!statusValues) continue;

        for(let i = 0; i < statusValues.length; i++){
            const statusString = statusValues[i];
            const jobId = sampleIds[i];

            if(!statusString && !jobsToRemove.includes(jobId)){
                jobsToRemove.push(jobId);
            }
        }
    }

    if(jobsToRemove.length > 0){
        await redis?.srem(teamJobsKey, ...jobsToRemove);
        console.log(`[Socket] Quick cleanup removed ${jobsToRemove.length} stale jobs from team ${teamId}`);
    }
};

export const initializeSocketIO = (server: http.Server): Server => {
    io = new Server(server, {
        cors: {
            origin: [
                process.env.CLIENT_DEV_HOST,
                process.env.CLIENT_HOST
            ],
            methods: ['GET', 'POST']
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        adapter: undefined 
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] User connected: ${socket.id}`);
        
        socket.on('subscribe_to_team', async ({ teamId, previousTeamId }) => {
            const initStart = Date.now();
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

            console.log(`[Socket] Socket ${socket.id} STARTING INIT for team ${teamId}`);
            socket.join(`team-${teamId}`);

            setImmediate(() => cleanupOldJobs(teamId));

            const initialJobs = await getJobsForTeam(teamId);
            socket.emit('team_jobs', initialJobs);

            const initDuration = Date.now() - initStart;
            console.log(`[Socket] INIT completed for socket ${socket.id} team ${teamId}: ${initialJobs.length} jobs in ${initDuration}ms`);

            setImmediate(async () => {
                await sendPendingUpdates(socket.id);
                initializingClients.delete(socket.id);
                console.log(`[Socket] Background updates completed for socket ${socket.id}`);
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
    if(!teamId || !jobData){
        console.warn('[Socket] emitJobUpdate called with missing teamId or jobData');
        return;
    }

    if(!io){
        console.warn('[Socket] Socket.IO not initialized yet');
        return;
    }

    const jobUpdate = {
        jobId: jobData.jobId,
        status: jobData.status,
        progress: jobData.progress || 0,
        chunkIndex: jobData.chunkIndex,
        totalChunks: jobData.totalChunks,
        name: jobData.name,
        message: jobData.message,
        timestamp: jobData.timestamp || new Date().toISOString(),
        queueType: jobData.queueType || 'unknown',
        ...(jobData.error && { error: jobData.error }),
        ...(jobData.result && { result: jobData.result }),
        ...(jobData.processingTimeMs && { processingTimeMs: jobData.processingTimeMs })
    };

    const hasInitializingClients = Array.from(initializingClients.values())
        .some((client) => client.teamId === teamId);

    if(hasInitializingClients){
        addPendingUpdate(teamId, jobUpdate);
        return;
    }

    const socketsInRoom = await io.in(`team-${teamId}`).fetchSockets();
    const readyClients = socketsInRoom.filter(s => !initializingClients.has(s.id));
    
    if(readyClients.length === 0){
        addPendingUpdate(teamId, jobUpdate);
        return;
    }

    readyClients.forEach((socket) => {
        socket.emit('job_update', jobUpdate);
    });

    console.log(`[Socket] Emitted job_update to ${readyClients.length} ready clients for team ${teamId} for job ${jobUpdate.jobId}`);
};

export const getIO = (): Server => {
    if(!io){
        throw new Error('Socket.io not initialized!');
    }

    return io;
};