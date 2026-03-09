import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export type GetTeamClusterByIdInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface GetTeamClusterByIdOutputDTO {
    teamCluster: TeamClusterDTO;
};
