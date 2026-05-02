import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface DeleteTeamClusterInputDTO {
    teamId: string;
    teamClusterId: string;
    password: string;
}

export interface DeleteTeamClusterOutputDTO {
    success: boolean;
    deleted: boolean;
    manualUninstallRequired: boolean;
    message: string;
    manualUninstallCommand?: string;
    teamCluster?: TeamCluster;
}
