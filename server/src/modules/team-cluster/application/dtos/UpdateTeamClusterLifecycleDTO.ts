import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';

export interface UpdateTeamClusterLifecycleInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};

export interface UpdateTeamClusterLifecycleOutputDTO {
    teamCluster: TeamClusterDTO;
};
