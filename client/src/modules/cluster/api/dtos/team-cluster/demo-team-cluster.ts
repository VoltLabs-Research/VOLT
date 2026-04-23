import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface ProvisionDemoTeamClusterInputDTO {
    teamId: string;
};

export interface ProvisionDemoTeamClusterOutputDTO {
    teamCluster: TeamCluster;
};

export interface GetDemoTeamClusterStatusInputDTO {
    teamId: string;
};

export interface GetDemoTeamClusterStatusOutputDTO {
    teamCluster: TeamCluster | null;
    remainingMs: number | null;
    hasActiveDemo: boolean;
};

export interface DeleteDemoTeamClusterInputDTO {
    teamId: string;
};

export interface DeleteDemoTeamClusterOutputDTO {
    teardownScheduled: boolean;
};
