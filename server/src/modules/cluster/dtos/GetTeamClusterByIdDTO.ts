import type { TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export type GetTeamClusterByIdInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface GetTeamClusterByIdOutputDTO {
    teamCluster: TeamClusterDTO;
}
