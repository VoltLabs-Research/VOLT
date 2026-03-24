import type { TeamCluster, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';

export interface UpdateTeamClusterRoleInputDTO {
    teamId: string;
    teamClusterId: string;
    role: TeamClusterRole;
};

export interface UpdateTeamClusterRoleOutputDTO {
    message: string;
    teamCluster: TeamCluster;
};
