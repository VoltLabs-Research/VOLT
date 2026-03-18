import type { TeamClusterFailureDetail } from '@modules/jobs/domain/port/ITeamJobMaintenanceService';

export interface ClearTeamJobsHistoryInputDTO {
    teamId: string;
};

export interface ClearTeamJobsHistoryOutputDTO {
    deletedJobs: number;
    deletedAnalyses: number;
    affectedClusters: number;
    clusterFailures: TeamClusterFailureDetail[];
};
