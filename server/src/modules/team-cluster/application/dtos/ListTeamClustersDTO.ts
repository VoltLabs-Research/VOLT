import type { PaginatedOutputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface ListTeamClustersInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
};

export type ListTeamClustersOutputDTO = PaginatedOutputDTO<TeamClusterDTO>;
