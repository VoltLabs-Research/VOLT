import type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/application/dtos/RecordTeamClusterHeartbeatDTO';
import type { TeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import type TeamCluster from '@modules/cluster/domain/entities/TeamCluster';
import type { TeamClusterRuntimeRoleConfigProps, TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';

export interface ITeamClusterLifecycleService {
    processHealthcheck(teamClusterId: string, enrollmentToken: string, installedVersion?: string): Promise<{
        teamCluster: TeamClusterDTO;
        daemonPassword: string;
    }>;
    updateLifecycleStatus(
        teamClusterId: string,
        daemonPassword: string,
        status: TeamClusterStatus,
        installedVersion?: string
    ): Promise<TeamClusterDTO>;
    recordHeartbeat(
        teamClusterId: string,
        daemonPassword: string,
        installedVersion?: string,
        runtime?: { roleConfig: TeamClusterRuntimeRoleConfigProps },
        metrics?: TeamClusterHeartbeatMetricsDTO
    ): Promise<TeamClusterDTO>;
    markDaemonConnected(teamClusterId: string): Promise<TeamClusterDTO>;
    markDaemonDisconnected(teamClusterId: string): Promise<TeamClusterDTO>;
    authenticateDaemonConnection(teamClusterId: string, daemonPassword: string): Promise<void>;
    markDeleting(teamClusterId: string): Promise<TeamClusterDTO>;
    completeDeletion(teamClusterId: string, daemonPassword: string): Promise<void>;
    finalizeDeletingClustersByEvidence(cutoff: Date): Promise<number>;
    markDeletingTimeouts(cutoff: Date): Promise<number>;
    deleteTeamCluster(teamCluster: TeamCluster): Promise<void>;
    publishTeamClusterUpdate(teamCluster: TeamCluster): void;
}
