import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import { Singleton } from '@shared/infrastructure/di/decorators';
import TeamJobsService, { type TeamJobsInitialPayload } from './TeamJobsService';

@Singleton()
export default class TeamJobsRealtimeSyncService {
    constructor(
        private readonly teamJobsService: TeamJobsService,
        private readonly socketEmitter: SocketIOEmitter
    ) {}

    async broadcastSnapshot(teamId: string): Promise<TeamJobsInitialPayload> {
        const snapshot = await this.teamJobsService.getInitialTeamJobs(teamId);
        this.socketEmitter.emitToRoom(`team:${teamId}`, 'team.jobs.initial', snapshot);
        return snapshot;
    }
}
