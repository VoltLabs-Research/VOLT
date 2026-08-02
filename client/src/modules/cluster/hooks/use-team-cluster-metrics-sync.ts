import { useClusterStore } from '@/modules/cluster/store/use-cluster-store';
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
import { useMemo } from 'react';
import type { ClusterMetrics, ClusterHistoryMetric } from '@volt/contracts/modules/cluster/domain';

interface ClusterMetricsHistoryEvent {
    clusterId: string;
    history: ClusterHistoryMetric[];
}

export default function useTeamClusterMetricsSync(): void {
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
            resetClusterHistoryQuery();
        }
    }, { runOnMount: true });

    useSocketEvent<ClusterMetrics[]>(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_ALL, (clusters) => {
        setClusterMetricsQueryData(clusters);
    }, { enabled: hasClusters });

    useSocketEvent<ClusterMetricsHistoryEvent>(SOCKET_CLUSTER_METRICS_EVENTS.METRICS_HISTORY, ({ clusterId, history }) => {
        setClusterHistoryQueryData(history, clusterId);
    }, { enabled: hasClusters });
}
