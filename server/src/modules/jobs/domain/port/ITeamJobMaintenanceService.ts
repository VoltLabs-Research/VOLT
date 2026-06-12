/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/ITeamJobMaintenanceService`) for the
 * detachable-modules migration. Re-exported here so existing importers of this
 * module path keep compiling unchanged.
 */
export type {
    ITeamJobMaintenanceService,
    TeamClusterFailureDetail,
    RemoveTeamJobsResult,
    RetryTeamJobsResult,
    TrajectoryDeletedCleanupInput,
    AnalysisDeletedCleanupInput
} from '@shared/contracts/ports/ITeamJobMaintenanceService';
