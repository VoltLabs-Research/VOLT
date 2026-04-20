import type { RemoveTeamJobsResult } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

export interface RemoveTeamRunningJobsInputDTO {
    teamId: string;
    trajectoryId: string;
};

export type RemoveTeamRunningJobsOutputDTO = RemoveTeamJobsResult;
