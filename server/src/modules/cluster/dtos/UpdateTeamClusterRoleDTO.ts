import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';
import type { TeamClusterRole } from '@modules/cluster/entities/TeamCluster';

export interface UpdateTeamClusterRoleInputDTO {
    teamId: string;
    userId: string;
    teamClusterId: string;
    role: TeamClusterRole;
}

export interface UpdateTeamClusterRoleOutputDTO {
    message: string;
    teamCluster: TeamClusterDTO;
}
