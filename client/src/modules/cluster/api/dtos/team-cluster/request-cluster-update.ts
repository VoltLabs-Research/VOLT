import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface RequestClusterUpdateInputDTO {
    teamId: string;
    teamClusterId: string;
    targetVersion: string;
    isEdge: boolean;
    password: string;
};

export interface RequestClusterUpdateOutputDTO {
    message: string;
    teamCluster: TeamCluster;
};
