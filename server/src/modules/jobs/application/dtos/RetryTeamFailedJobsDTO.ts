import type { TeamClusterFailureDetail } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

export interface RetryTeamFailedJobsInputDTO {
    teamId: string;
};

export interface RetryTeamFailedJobsOutputDTO {
    retriedFrames: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};
