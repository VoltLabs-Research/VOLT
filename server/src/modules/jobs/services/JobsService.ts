import type {
    ITeamJobMaintenanceService,
    RemoveTeamJobsResult,
    RetryTeamJobsResult
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import TeamJobsRealtimeSyncService from '@modules/team/socket/team/TeamJobsRealtimeSyncService';
import type { TeamJobsInitialPayload } from '@modules/team/socket/team/TeamJobsService';
import { container as diContainer } from 'tsyringe';

interface RemoveRunningJobsInput {
    teamId: string;
    trajectoryId: string;
}

interface RetryFailedJobsInput {
    teamId: string;
    trajectoryId: string;
}

export interface RemoveRunningJobsResult extends RemoveTeamJobsResult, TeamJobsInitialPayload {}

/**
 * The single application service for the jobs module (pollium style): folds the
 * two former use cases verbatim. It `new`s nothing of its own — its two
 * collaborators are genuinely-shared stateful singletons resolved once from the
 * DI container:
 *  - maintenance: `ITeamJobMaintenanceService` (redis + daemon client + event
 *    bus) registered under the neutral `COMPUTE_TOKENS.TeamJobMaintenanceService`
 *    and also injected by the trajectory/analysis cleanup handlers.
 *  - realtimeSync: the team module's `TeamJobsRealtimeSyncService`
 *    (socket-backed team-jobs broadcaster), shared with the team socket layer.
 * Both surface typed `ApplicationError`s on their own; this service just merges
 * their results for the HTTP path (no Result channel).
 */
export default class JobsService {
    #maintenance = diContainer.resolve<ITeamJobMaintenanceService>(COMPUTE_TOKENS.TeamJobMaintenanceService);
    #realtimeSync = diContainer.resolve(TeamJobsRealtimeSyncService);

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
