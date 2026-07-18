import type { PaginatedOutputDTO } from '@modules/cluster/dtos/_teamScoped';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export interface ListTeamClustersInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
}

export type ListTeamClustersOutputDTO = PaginatedOutputDTO<TeamClusterDTO>;
