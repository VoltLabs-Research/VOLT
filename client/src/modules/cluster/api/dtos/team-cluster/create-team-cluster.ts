import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface CreateTeamClusterInputDTO {
    teamId: string;
    name: string;
};

export interface CreateTeamClusterOutputDTO {
    teamCluster: TeamCluster;
    enrollmentToken: string;
};
