import type { TeamCluster, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';

export interface CreateTeamClusterInputDTO {
    teamId: string;
    name: string;
    role?: TeamClusterRole;
};

export interface CreateTeamClusterOutputDTO {
    teamCluster: TeamCluster;
    enrollmentToken: string;
};
