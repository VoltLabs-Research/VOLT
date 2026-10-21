import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import { TEAM_CLUSTER_EVENT } from '@shared/contracts/types/team-cluster-daemon-channel';
import type {
    TeamClusterDaemonHeartbeatCommand,
    TeamClusterDaemonMessage as SdkTeamClusterDaemonMessage
} from '@voltstack/daemon-cluster-client';
import type { DaemonJobEvent } from '@volt/contracts/modules/cluster/daemon-events';

export type TeamClusterDaemonServerEventMessage =
    | DaemonJobEvent
    | (TeamClusterDaemonHeartbeatCommand & { type: 'runtime-heartbeat' });

export type TeamClusterDaemonMessage = SdkTeamClusterDaemonMessage | TeamClusterDaemonServerEventMessage;

export const TEAM_CLUSTER_LIFECYCLE_EVENT = TEAM_CLUSTER_EVENT.lifecycleUpdated;
export const TEAM_CLUSTER_SUBSCRIPTION_EVENT = 'subscribe_to_team_cluster';

export const getTeamClusterRoom = (teamClusterId: string): string => {
    return `team-cluster:${teamClusterId}`;
};

export const TEAM_CLUSTER_METRICS_ALL_EVENT = 'metrics:all';
export const TEAM_CLUSTER_METRICS_HISTORY_EVENT = 'metrics:history';

interface TeamClusterClientMetrics extends SystemMetrics {
    clusterId: string;
    teamClusterId: string;
    teamClusterName: string;
    teamClusterStatus: TeamCluster['props']['status'];
}

export const toTeamClusterClientMetrics = (
    teamCluster: TeamCluster,
    metrics: SystemMetrics
): TeamClusterClientMetrics => ({
    ...metrics,
    clusterId: teamCluster.id,
    teamClusterId: metrics.teamClusterId ?? teamCluster.id,
    teamClusterName: teamCluster.props.name,
    teamClusterStatus: teamCluster.props.status
});
