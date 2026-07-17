import { useClusterStore } from '@/modules/cluster/stores/use-cluster-store';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useTeamClusterSocket } from '@/modules/cluster/hooks/team-cluster/use-team-cluster-socket';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SOCKET_CLUSTER_METRICS_EVENTS } from '@/modules/socket/events/cluster';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import useSocketConnectionEffect from '@/modules/socket/hooks/use-socket-connection-effect';
import {
    resetClusterHistoryQuery,
    setClusterHistoryQueryData,
    setClusterMetricsQueryData
} from '@/modules/cluster/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ClusterMetrics, ClusterHistoryMetric } from '@/modules/cluster/api/types/cluster-metrics';

interface ClusterMetricsHistoryEvent {
    clusterId: string;
    history: ClusterHistoryMetric[];
}

/**
 * Keeps the team cluster metrics stream alive for the whole authenticated
 * session. Mounted once in ProtectedRouteRealtimeEffects so the room
 * subscription and live-metric listeners survive navigation across the
 * dashboard/canvas route branches — without this, the only subscriber was the
 * dashboard bottom bar, so leaving /dashboard stopped the stream and stats went
 * blank for a few seconds on return. Consumers (useClusterMetrics) only read
 * the cache this hook fills.
 */
export default function useTeamClusterMetricsSync(): void {
    const queryClient = useQueryClient();
    const selectedTeamId = useSelectedTeamId();
    const setConnected = useClusterStore((state) => state.setConnected);

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });

    const teamClusterIds = useMemo(() => {
        return (teamClustersQuery.data?.data ?? []).map((cluster) => cluster._id);
    }, [teamClustersQuery.data]);

    const hasClusters = teamClusterIds.length > 0;

    useTeamClusterSocket(teamClusterIds);

    useSocketConnectionEffect((connected) => {
        setConnected(connected);
        if (!connected) {
            resetClusterHistoryQuery(queryClient);
        }
    }, { runOnMount: true });

    useSocketEvent<ClusterMetrics[]>(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_ALL, (clusters) => {
        setClusterMetricsQueryData(clusters);
    }, { enabled: hasClusters });

    useSocketEvent<ClusterMetricsHistoryEvent>(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_HISTORY, ({ clusterId, history }) => {
        setClusterHistoryQueryData(history, clusterId);
    }, { enabled: hasClusters });
}
