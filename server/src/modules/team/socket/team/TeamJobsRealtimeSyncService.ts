import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import teamJobsService, { type TeamJobsInitialPayload } from './TeamJobsService';

class TeamJobsRealtimeSyncService {
    async broadcastSnapshot(teamId: string): Promise<TeamJobsInitialPayload> {
        const snapshot = await teamJobsService.getInitialTeamJobs(teamId);
        socketIOEmitter.emitToRoom(`team:${teamId}`, 'team.jobs.initial', snapshot);
        return snapshot;
    }
}

export default new TeamJobsRealtimeSyncService();
