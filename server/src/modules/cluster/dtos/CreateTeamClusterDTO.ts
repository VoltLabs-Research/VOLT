import type { TeamUserScopedInputDTO } from '@modules/cluster/dtos/_teamScoped';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export interface CreateTeamClusterInputDTO extends TeamUserScopedInputDTO {
    name: string;
}

export interface CreateTeamClusterOutputDTO {
    teamCluster: TeamClusterDTO;
    enrollmentToken: string;
}
