import type { TeamClusterRuntimeRoleConfigProps } from '@modules/cluster/entities/TeamCluster';
import type { TeamClusterDTO } from '@modules/cluster/dtos/TeamClusterDTO';
import type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/contracts/TeamClusterHeartbeat';

export type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/contracts/TeamClusterHeartbeat';

export interface RecordTeamClusterHeartbeatInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    runtime?: {
        roleConfig: TeamClusterRuntimeRoleConfigProps;
    };
    metrics?: TeamClusterHeartbeatMetricsDTO;
}

export interface RecordTeamClusterHeartbeatOutputDTO {
    teamCluster: TeamClusterDTO;
}
