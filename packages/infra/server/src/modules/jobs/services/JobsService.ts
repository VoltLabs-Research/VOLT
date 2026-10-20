import type { RemoveTeamJobsResult, RetryTeamJobsResult } from '@volt/contracts/modules/jobs/domain';
import teamJobMaintenanceService from '@modules/jobs/services/TeamJobMaintenanceService';
import teamJobsRealtimeSyncService from '@modules/team/socket/team/TeamJobsRealtimeSyncService';
import teamJobsService, { type TeamJobsInitialPayload } from '@modules/team/socket/team/TeamJobsService';

interface TeamTrajectoryRef {
    teamId: string;
    trajectoryId: string;
}

interface RemoveRunningJobsResult extends RemoveTeamJobsResult, TeamJobsInitialPayload {}

class JobsService {

    async removeRunningJobs(input: TeamTrajectoryRef): Promise<RemoveRunningJobsResult> {
        const outcome = await teamJobMaintenanceService.removeJobsForTrajectory(input.teamId, input.trajectoryId);
        const snapshot = await teamJobsRealtimeSyncService.broadcastSnapshot(input.teamId);

        return {
            ...outcome,
            ...snapshot
        };
    }

    async retryFailedJobs(input: TeamTrajectoryRef): Promise<RetryTeamJobsResult> {
        return teamJobMaintenanceService.retryFailedJobsForTrajectory(input.teamId, input.trajectoryId);
    }
}

export default new JobsService();
