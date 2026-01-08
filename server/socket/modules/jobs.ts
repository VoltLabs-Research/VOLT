import { Server, Socket } from 'socket.io';
import { publishJobUpdate } from '@/events/job-updates';
import { ClientData } from '@/types/config/socket';
import BaseSocketModule from '@/socket/base-socket-module';
import logger from '@/logger';
import trajectoryJobsService from '@/services/trajectory-jobs-service';

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

            // Delegate aggregation to service
            const groups = await trajectoryJobsService.getGroupedJobsForTeam(teamId);
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

        // Delegate normalization to service
        const update = trajectoryJobsService.normalizeUpdate(jobData);

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
}

export default JobsModule;
