import { Server } from 'socket.io';
import { redis } from '@config/redis';
import { getTrajectoryProcessingQueue } from '@/queues';
import http from 'http';

let io: Server;

const getJobsForTeam = async (teamId: string): Promise<any[]> => {
    if(!teamId) return [];

    try{
        console.log(`[Socket] Getting jobs for team ${teamId}...`);
        const queue = getTrajectoryProcessingQueue();
        const statusKeyPrefix = `${queue.queueKey}:status:`;
        const stream = redis?.scanStream({ match: `${statusKeyPrefix}*`, count: 250 });
        const statusKeys: string[] = [];

        for await (const keys of stream){
            statusKeys.push(...keys);
        }

        console.log(`[Socket] Found ${statusKeys.length} total job status keys`);
        
        if(statusKeys.length === 0){
            return [];
        }

        const jobsWithData = [];
        for(const key of statusKeys){
            const statusString = await redis?.get(key);
            if(!statusString) continue;

            const jobStatus = JSON.parse(statusString);
            console.log(`[Socket] Job ${jobStatus.jobId}: teamId=${jobStatus.teamId}, looking for=${teamId}`);

            if(jobStatus.teamId === teamId){
                jobsWithData.push({
                    jobId: jobStatus.jobId,
                    status: jobStatus.status,
                    progress: jobStatus.progress || 0,
                    chunkIndex: jobStatus.chunkIndex,
                    totalChunks: jobStatus.totalChunks,
                    name: jobStatus.name,
                    message: jobStatus.message,
                    timestamp: jobStatus.timestamp
                });
                console.log(`[Socket] Added job ${jobStatus.jobId} to team ${teamId} results`);
            }
        }

        console.log(`[Socket] Found and sending ${jobsWithData.length} initial jobs for team ${teamId}`);
        return jobsWithData;
    }catch(err){
        console.error(`[Socket] Critical error fetching jobs for team ${teamId}:`, err);
        return [];
    }
};

export const initializeSocketIO = (server: http.Server): Server => {
    io = new Server(server, {
        cors: {
            origin: [
                // TODO:
                process.env.CLIENT_DEV_HOST,
                process.env.CLIENT_HOST
            ],
            methods: ['GET', 'POST']
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] User connected: ${socket.id}`);

        socket.on('subscribe_to_team', async ({ teamId, previousTeamId }) => {
            if(previousTeamId){
                socket.leave(`team-${previousTeamId}`);
                console.log(`[Socket] Socket ${socket.id} left room: team-${previousTeamId}`);         
            }

            if(!teamId) return;
            
            socket.join(`team-${teamId}`);
            console.log(`[Socket] Socket ${socket.id} joined room: team-${teamId}`);
           
            const socketsInRoom = await io.in(`team-${teamId}`).fetchSockets();
            console.log(`[Socket] Room team-${teamId} now has ${socketsInRoom.length} connected socket(s)`);

            const initialJobs = await getJobsForTeam(teamId);
            socket.emit('team_jobs', initialJobs);
            console.log(`[Socket] Emitted ${initialJobs.length} initial jobs to socket ${socket.id}`);
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = (): Server => {
    if(!io){
        throw new Error('Socket.io not initialized!');
    }

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

    const socketsInRoom = await io.in(`team-${teamId}`).fetchSockets();
    console.log(`[Socket] Emitting to ${socketsInRoom.length} socket(s) in room team-${teamId}`);

    if(socketsInRoom.length === 0){
        console.log(`[Socket] No sockets connected to team-${teamId}, skipping emission`);
        return;
    }

        const jobUpdate = {
        jobId: jobData.jobId,
        status: jobData.status,
        progress: jobData.progress || 0,
        chunkIndex: jobData.chunkIndex,
        totalChunks: jobData.totalChunks,
        timestamp: jobData.timestamp || new Date().toISOString(),
        ...(jobData.error && { error: jobData.error }),
        ...(jobData.result && { result: jobData.result }),
        ...(jobData.processingTimeMs && { processingTimeMs: jobData.processingTimeMs })
    };
    
    io.to(`team-${teamId}`).emit('job_update', jobUpdate);
    console.log(`[Socket]: Emitted job_update for team ${teamId} for job ${jobUpdate.jobId} with status: ${jobUpdate.status}`);
};