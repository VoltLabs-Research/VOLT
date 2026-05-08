import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export interface ProvisionDemoTeamClusterInputDTO {
    teamId: string;
}

export interface ProvisionDemoTeamClusterOutputDTO {
    teamCluster: TeamCluster;
}
