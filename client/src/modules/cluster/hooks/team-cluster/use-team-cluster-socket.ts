import { SOCKET_TEAM_CLUSTER_EVENTS } from '@/modules/socket/events/cluster';
import { applyTeamClusterLifecycleEvent } from '@/modules/cluster/hooks/team-cluster/queries';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useSocketRoom from '@/modules/socket/hooks/use-socket-room';
import type { TeamClusterLifecycleEvent } from '@/modules/cluster/api/entities/team-cluster';

export const useTeamClusterSocket = (teamClusterIds: string[]) => {
    const roomKey = teamClusterIds.length > 0 ? teamClusterIds.join(',') : null;

    useSocketRoom({
        joinEvent: SOCKET_TEAM_CLUSTER_EVENTS.SUBSCRIBE,
        roomKey,
        buildJoinPayload: () => teamClusterIds.length > 0 ? { teamClusterIds } : null,
        enabled: teamClusterIds.length > 0,
        fireAndForget: true
    });

    useSocketEvent<TeamClusterLifecycleEvent>(SOCKET_TEAM_CLUSTER_EVENTS.LIFECYCLE_UPDATED, (event) => {
        applyTeamClusterLifecycleEvent(event);
    });
};
