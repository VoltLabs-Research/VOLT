import { Server, Socket } from 'socket.io';
import { publishJobUpdate } from '@/events/job-updates';
import { redis } from '@config/redis';
import { getTrajectoryProcessingQueue, getAnalysisQueue, getRasterizerQueue, getSSHImportQueue, getCloudUploadQueue } from '@/queues';
import { BaseJob } from '@/types/queues/base-processing-queue';
import { ClientData, ProcessingQueue } from '@/types/config/socket';
import BaseSocketModule from '@/socket/base-socket-module';
import logger from '@/logger';

interface FrameJobGroup {
    timestep: number;
    jobs: BaseJob[];
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
}

interface TrajectoryJobGroup {
    trajectoryId: string;
    trajectoryName: string;
    frameGroups: FrameJobGroup[];
    latestTimestamp: string;
    overallStatus: 'running' | 'completed' | 'failed' | 'partial';
    completedCount: number;
    totalCount: number;
}

class JobsModule extends BaseSocketModule {
    private initializingClients = new Map<string, ClientData>();

    constructor() {
        super('JobsModule');
    }

    onInit(io: Server): void {
        this.io = io;
    }

    onConnection(socket: Socket): void {
        socket.on('subscribe_to_team', async ({ teamId, previousTeamId }) => {
            if (previousTeamId) this.leaveRoom(socket, `team-${previousTeamId}`);
            this.initializingClients.delete(socket.id);
            if (!teamId) return;

            this.initializingClients.set(socket.id, {
                teamId,
                initStartTime: Date.now(),
                pendingUpdates: []
            });

            this.joinRoom(socket, `team-${teamId}`);
            const groups = await this.getGroupedJobsForTeam(teamId);
            socket.emit('team_jobs', groups);

            setImmediate(async () => {
                await this.sendPendingUpdates(socket.id);
                this.initializingClients.delete(socket.id);
            });
        });

        socket.on('disconnect', () => {
            this.initializingClients.delete(socket.id);
        });
    }

    async emitJobUpdate(teamId: string, payload: any): Promise<void> {
        if (!teamId || !payload) return;
        await publishJobUpdate(teamId, payload);
    }

    async reemitLocal(teamId: string, jobData: any): Promise<void> {
        if (!this.io) return;

        const update = this.normalizeUpdate(jobData);
        if (this.hasAnyInitializingForTeam(teamId)) {
            this.addPendingUpdate(teamId, update);
            return;
        }

        try {
            const sockets = await this.io.in(`team-${teamId}`).fetchSockets();
            const ready = sockets.filter((s) => !this.initializingClients.has(s.id));
            if (ready.length === 0) {
                this.addPendingUpdate(teamId, update);
                return;
            }
            ready.forEach((s) => s.emit('job_update', update));
        } catch (error) {
            logger.error(`[${this.name}] Error fetching sockets: ${error}`);
            this.io.to(`team-${teamId}`).emit('job_update', update);
        }
    }

    private hasAnyInitializingForTeam(teamId: string): boolean {
        for (const c of this.initializingClients.values()) {
            if (c.teamId === teamId) return true;
        }
        return false;
    }

    private addPendingUpdate(teamId: string, jobData: any): void {
        for (const c of this.initializingClients.values()) {
            if (c.teamId !== teamId) continue;
            c.pendingUpdates.push(jobData);
            if (c.pendingUpdates.length > 1000) c.pendingUpdates = c.pendingUpdates.slice(-50);
        }
    }

    private async sendPendingUpdates(socketId: string): Promise<void> {
        if (!this.io) return;
        const client = this.initializingClients.get(socketId);
        if (!client || client.pendingUpdates.length === 0) return;
        const socket = this.io.sockets.sockets.get(socketId);
        if (!socket) return;

        const batchSize = 10;
        for (let i = 0; i < client.pendingUpdates.length; i += batchSize) {
            client.pendingUpdates.slice(i, i + batchSize).forEach((u) => socket.emit('job_update', u));
            if (i + batchSize < client.pendingUpdates.length) await new Promise((r) => setTimeout(r, 10));
        }
        client.pendingUpdates.length = 0;
    }

    private getAllProcessingQueues(): ProcessingQueue[] {
        return [
            { name: 'trajectory', queue: getTrajectoryProcessingQueue() },
            { name: 'analysis', queue: getAnalysisQueue() },
            { name: 'raster', queue: getRasterizerQueue() },
            { name: 'ssh-import', queue: getSSHImportQueue() },
            { name: 'cloud-upload', queue: getCloudUploadQueue() }
        ];
    }

    private computeStatus(jobs: BaseJob[]): 'running' | 'completed' | 'failed' | 'partial' {
        const hasRunning = jobs.some((j: any) => j.status === 'running' || j.status === 'queued');
        const hasFailed = jobs.some((j: any) => j.status === 'failed');
        const allCompleted = jobs.every((j: any) => j.status === 'completed');
        if (hasRunning) return 'running';
        if (allCompleted) return 'completed';
        if (hasFailed && jobs.filter((j: any) => j.status === 'completed').length === 0) return 'failed';
        return 'partial';
    }

    private groupJobsByFrame(jobs: BaseJob[]): FrameJobGroup[] {
        const frameMap = new Map<number, BaseJob[]>();
        for (const job of jobs) {
            const key = (job as any).timestep;
            if (!frameMap.has(key)) frameMap.set(key, []);
            frameMap.get(key)!.push(job);
        }

        const result: FrameJobGroup[] = [];
        for (const [timestep, frameJobs] of frameMap) {
            const sorted = this.sortByTimestamp(frameJobs);
            result.push({ timestep, jobs: sorted, overallStatus: this.computeStatus(frameJobs) });
        }

        return result.sort((a, b) => b.timestep - a.timestep);
    }

    private groupJobsByTrajectory(jobs: BaseJob[]): TrajectoryJobGroup[] {
        const trajMap = new Map<string, BaseJob[]>();
        for (const job of jobs) {
            const trajId = job.trajectoryId;
            if (!trajMap.has(trajId)) trajMap.set(trajId, []);
            trajMap.get(trajId)!.push(job);
        }

        const result: TrajectoryJobGroup[] = [];
        for (const [trajectoryId, trajJobs] of trajMap) {
            const sorted = this.sortByTimestamp(trajJobs);
            const completedCount = sorted.filter((j: any) => j.status === 'completed').length;
            const trajectoryName = sorted[0].trajectoryName;
            const latestTimestamp = (sorted[0] as any)?.timestamp || new Date().toISOString();

            result.push({
                trajectoryId,
                trajectoryName,
                frameGroups: this.groupJobsByFrame(sorted),
                latestTimestamp,
                overallStatus: this.computeStatus(sorted),
                completedCount,
                totalCount: sorted.length
            });
        }

        return result.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());
    }

    private sortByTimestamp(jobs: BaseJob[]): BaseJob[] {
        return [...jobs].sort((a, b) => {
            const ta = (a as any).timestamp ? new Date((a as any).timestamp).getTime() : 0;
            const tb = (b as any).timestamp ? new Date((b as any).timestamp).getTime() : 0;
            return tb - ta;
        });
    }

    private async getGroupedJobsForTeam(teamId: string): Promise<TrajectoryJobGroup[]> {
        if (!teamId) return [];
        const startTime = Date.now();
        logger.info(`[Socket] Fetching grouped jobs for team ${teamId}...`);

        const allQueues = this.getAllProcessingQueues();
        const teamJobsKey = `team:${teamId}:jobs`;
        const jobIds = await redis?.smembers(teamJobsKey);

        if (!jobIds?.length) {
            logger.info(`[Socket] No jobs found for team ${teamId}`);
            return [];
        }

        const queueResults = await Promise.all(allQueues.map(async ({ name, queue }) => {
            const statusKeys = jobIds.map((id) => `${queue.queueKey}:status:${id}`);
            const batchSize = 500;
            const jobs: BaseJob[] = [];

            for (let i = 0; i < statusKeys.length; i += batchSize) {
                const batchKeys = statusKeys.slice(i, i + batchSize);
                const pipeline = redis?.pipeline();
                batchKeys.forEach((k) => pipeline?.get(k));
                const results = (await pipeline?.exec()) || [];

                for (const [_, value] of results) {
                    if (!value) continue;
                    const data = JSON.parse(value as string);
                    if (data.teamId !== teamId) continue;
                    jobs.push({ ...data, queueType: name });
                }
            }
            return jobs;
        }));

        const jobMap = new Map<string, BaseJob>();
        for (const job of queueResults.flat()) {
            const prev = jobMap.get(job.jobId);
            const tNew = (job as any).timestamp ? new Date((job as any).timestamp).getTime() : 0;
            const tPrev = (prev as any)?.timestamp ? new Date((prev as any).timestamp).getTime() : 0;
            if (!prev || tNew > tPrev) jobMap.set(job.jobId, job);
        }

        const uniqueJobs = Array.from(jobMap.values());
        const grouped = this.groupJobsByTrajectory(uniqueJobs);

        logger.info(`[Socket] Grouped ${uniqueJobs.length} jobs into ${grouped.length} trajectories in ${Date.now() - startTime}ms`);
        return grouped;
    }

    private normalizeUpdate(jobData: any) {
        return {
            jobId: jobData.jobId,
            status: jobData.status,
            progress: jobData.progress || 0,
            name: jobData.name,
            message: jobData.message,
            trajectoryId: jobData.trajectoryId,
            trajectoryName: jobData.trajectoryName,
            timestep: jobData.timestep,
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

