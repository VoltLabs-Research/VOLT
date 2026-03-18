import type { TeamClusterFailureDetail } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

export interface RemoveTeamRunningJobsInputDTO {
    teamId: string;
};

export interface RemoveTeamRunningJobsOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};
