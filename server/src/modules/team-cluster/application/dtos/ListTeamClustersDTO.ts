import type { PaginatedOutputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { TeamClusterRole } from '@modules/team-cluster/domain/entities/TeamCluster';

export interface ListTeamClustersInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
    roles?: TeamClusterRole[];
};

export type ListTeamClustersOutputDTO = PaginatedOutputDTO<TeamClusterDTO>;
