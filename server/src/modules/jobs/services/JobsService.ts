import type {
    RemoveTeamJobsResult,
    RetryTeamJobsResult
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import TeamJobsRealtimeSyncService from '@modules/team/socket/team/TeamJobsRealtimeSyncService';
import TeamJobsService, { type TeamJobsInitialPayload } from '@modules/team/socket/team/TeamJobsService';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';

interface TeamTrajectoryRef {
    teamId: string;
    trajectoryId: string;
}

interface RemoveRunningJobsResult extends RemoveTeamJobsResult, TeamJobsInitialPayload {}

export default class JobsService {
    #realtimeSync = new TeamJobsRealtimeSyncService(new TeamJobsService(), socketIOEmitter);

    async removeRunningJobs(input: TeamTrajectoryRef): Promise<RemoveRunningJobsResult> {
        const outcome = await teamJobMaintenanceService.removeJobsForTrajectory(input.teamId, input.trajectoryId);
        const snapshot = await this.#realtimeSync.broadcastSnapshot(input.teamId);

        return {
            ...outcome,
            ...snapshot
        };
    }

    async retryFailedJobs(input: TeamTrajectoryRef): Promise<RetryTeamJobsResult> {
        return teamJobMaintenanceService.retryFailedJobsForTrajectory(input.teamId, input.trajectoryId);
    }
}
