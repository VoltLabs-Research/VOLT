import type {
    RemoveTeamJobsResult,
    RetryTeamJobsResult
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import TeamJobsRealtimeSyncService from '@modules/team/socket/team/TeamJobsRealtimeSyncService';
import TeamJobsService, { type TeamJobsInitialPayload } from '@modules/team/socket/team/TeamJobsService';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';

interface RemoveRunningJobsInput {
    teamId: string;
    trajectoryId: string;
}

interface RetryFailedJobsInput {
    teamId: string;
    trajectoryId: string;
}

interface RemoveRunningJobsResult extends RemoveTeamJobsResult, TeamJobsInitialPayload {}

export default class JobsService {
    #maintenance = teamJobMaintenanceService;

    #realtimeSyncCache?: TeamJobsRealtimeSyncService;
    get #realtimeSync(): TeamJobsRealtimeSyncService {
        return (this.#realtimeSyncCache ??= new TeamJobsRealtimeSyncService(
            new TeamJobsService(),
            socketIOEmitter
        ));
    }

    async removeRunningJobs(input: RemoveRunningJobsInput): Promise<RemoveRunningJobsResult> {
        const outcome = await this.#maintenance.removeJobsForTrajectory(input.teamId, input.trajectoryId);
        const snapshot = await this.#realtimeSync.broadcastSnapshot(input.teamId);

        return {
            ...outcome,
            ...snapshot
        };
    }

    async retryFailedJobs(input: RetryFailedJobsInput): Promise<RetryTeamJobsResult> {
        return this.#maintenance.retryFailedJobsForTrajectory(input.teamId, input.trajectoryId);
    }
}
