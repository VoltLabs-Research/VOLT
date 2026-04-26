import type { TeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import type { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';

export interface UpdateTeamClusterLifecycleInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};

export interface UpdateTeamClusterLifecycleOutputDTO {
    teamCluster: TeamClusterDTO;
};
