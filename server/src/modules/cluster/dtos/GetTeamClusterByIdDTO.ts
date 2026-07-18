import type { TeamScopedEntityIdInputDTO } from '@modules/cluster/dtos/_teamScoped';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export type GetTeamClusterByIdInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface GetTeamClusterByIdOutputDTO {
    teamCluster: TeamClusterDTO;
}
