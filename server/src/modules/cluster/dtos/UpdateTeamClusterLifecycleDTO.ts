import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';
import type { TeamClusterStatus } from '@modules/cluster/entities/TeamCluster';

export interface UpdateTeamClusterLifecycleInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
}

export interface UpdateTeamClusterLifecycleOutputDTO {
    teamCluster: TeamClusterDTO;
}
