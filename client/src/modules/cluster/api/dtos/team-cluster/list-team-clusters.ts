import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface ListTeamClustersInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    search?: string;
};

export type ListTeamClustersOutputDTO = PaginatedResponse<TeamCluster>;
