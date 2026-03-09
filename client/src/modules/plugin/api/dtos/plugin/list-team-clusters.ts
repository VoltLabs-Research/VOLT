import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PluginTeamClusterOption } from '@/modules/plugin/api/entities/plugin/team-cluster';

export interface ListPluginTeamClustersInputDTO {
    teamId: string;
    page: number;
    limit: number;
};

export type ListPluginTeamClustersOutputDTO = PaginatedResponse<PluginTeamClusterOption>;
