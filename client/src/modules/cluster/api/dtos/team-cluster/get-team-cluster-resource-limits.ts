import type { ClusterResourceLimits } from '@/modules/container/api/entities/cluster-resource-limits';

export interface GetTeamClusterResourceLimitsInputDTO {
    teamId: string;
    teamClusterId: string;
}

export interface GetTeamClusterResourceLimitsOutputDTO {
    resourceLimits: ClusterResourceLimits;
}
