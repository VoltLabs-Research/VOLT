import type { RetryTeamJobsResult } from '@shared/contracts/ports/ITeamJobMaintenanceService';

export interface RetryTeamFailedJobsInputDTO {
    teamId: string;
    trajectoryId: string;
}

export type RetryTeamFailedJobsOutputDTO = RetryTeamJobsResult;
