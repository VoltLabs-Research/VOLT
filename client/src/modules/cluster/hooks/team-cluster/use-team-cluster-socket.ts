import { TEAM_CLUSTER_SOCKET_EVENTS } from '@/modules/cluster/api/service/endpoints/team-cluster-socket-events';
import { applyTeamClusterLifecycleEvent } from '@/modules/cluster/hooks/team-cluster/queries';
import socketService from '@/modules/socket/core/services/socket-service';
import { useEffect, useRef } from 'react';
import type { TeamClusterLifecycleEvent } from '@/modules/cluster/api/entities/team-cluster';

export const useTeamClusterSocket = (teamClusterIds: string[]) => {
    const teamClusterIdsRef = useRef(teamClusterIds);

    teamClusterIdsRef.current = teamClusterIds;

    const subscribeToAll = (ids: string[]) => {
        socketService.emit(TEAM_CLUSTER_SOCKET_EVENTS.subscribe, {
            teamClusterIds: ids
        }).catch(() => undefined);
    };

    useEffect(() => {
        subscribeToAll(teamClusterIds);
    }, [teamClusterIds.join(',')]);

    useEffect(() => {
        return socketService.onConnectionChange((connected) => {
            if (connected) {
                subscribeToAll(teamClusterIdsRef.current);
            }
        });
    }, []);

    useEffect(() => {
        const unsubscribe = socketService.on<[TeamClusterLifecycleEvent]>(
            TEAM_CLUSTER_SOCKET_EVENTS.lifecycleUpdated,
            (event) => {
                applyTeamClusterLifecycleEvent(event);
            }
        );

        return unsubscribe;
    }, []);
};
