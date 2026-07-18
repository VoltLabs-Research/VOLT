import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';

export interface ProcessTeamClusterHealthcheckInputDTO {
    teamClusterId: string;
    enrollmentToken: string;
    installedVersion?: string;
}

export interface ProcessTeamClusterHealthcheckOutputDTO {
    teamCluster: TeamClusterDTO;
    daemonPassword: string;
}
