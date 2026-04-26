import type { TeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import type { TeamClusterRole } from '@modules/cluster/domain/entities/TeamCluster';

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
