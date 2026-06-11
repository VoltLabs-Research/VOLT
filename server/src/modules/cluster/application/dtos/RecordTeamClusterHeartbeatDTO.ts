import type { TeamClusterRuntimeRoleConfigProps } from '@modules/cluster/domain/entities/TeamCluster';
import type { TeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/domain/contracts/TeamClusterHeartbeat';

export type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/domain/contracts/TeamClusterHeartbeat';

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
