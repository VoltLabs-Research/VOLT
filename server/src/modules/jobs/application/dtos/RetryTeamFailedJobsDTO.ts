import type { RetryTeamJobsResult } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

export interface RetryTeamFailedJobsInputDTO {
    teamId: string;
    trajectoryId: string;
};

export type RetryTeamFailedJobsOutputDTO = RetryTeamJobsResult;
