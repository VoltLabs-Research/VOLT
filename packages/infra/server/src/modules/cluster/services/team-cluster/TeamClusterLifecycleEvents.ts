import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import type { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import { toTeamClusterView, type TeamClusterView } from '@modules/cluster/services/team-cluster/TeamClusterView';
import {
    getTeamClusterRoom,
    toTeamClusterClientMetrics,
    TEAM_CLUSTER_LIFECYCLE_EVENT,
    TEAM_CLUSTER_METRICS_ALL_EVENT
} from '@modules/cluster/socket/TeamClusterSocketProtocol';

interface TeamClusterLifecycleEventPayload {
    teamClusterId: string;
    teamId: string;
    deleted: boolean;
    teamCluster?: TeamClusterView;
    status?: TeamClusterStatus;
    timestamp: string;
}

const emitLifecycleEvent = (teamCluster: TeamCluster, payload: TeamClusterLifecycleEventPayload): void => {
    socketIOEmitter.emitToRoom(
        getTeamClusterRoom(teamCluster.id),
        TEAM_CLUSTER_LIFECYCLE_EVENT,
        payload
    );
};

export const emitTeamClusterLifecycleUpdate = (teamCluster: TeamCluster): void => {
    emitLifecycleEvent(teamCluster, {
        teamClusterId: teamCluster.id,
        teamId: teamCluster.props.team,
        deleted: false,
        teamCluster: toTeamClusterView(teamCluster),
        status: teamCluster.props.status,
        timestamp: new Date().toISOString()
    });
};

export const emitTeamClusterLifecycleDeletion = (teamCluster: TeamCluster): void => {
    emitLifecycleEvent(teamCluster, {
        teamClusterId: teamCluster.id,
        teamId: teamCluster.props.team,
        deleted: true,
        timestamp: new Date().toISOString()
    });
};

export const emitTeamClusterMetricsUpdate = (teamCluster: TeamCluster, metrics: SystemMetrics): void => {
    socketIOEmitter.emitToRoom(
        getTeamClusterRoom(teamCluster.id),
        TEAM_CLUSTER_METRICS_ALL_EVENT,
        [toTeamClusterClientMetrics(teamCluster, metrics)]
    );
};
