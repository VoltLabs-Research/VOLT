import { useClusterStore } from '../stores/use-cluster-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import teamSocketRoomService from '@/modules/socket/team/services/team-socket-room-service';
import {
    clusterHistoryLoadedQuery,
    clusterHistoryQuery,
    clusterMetricsQuery,
    resetClusterHistoryQuery,
    setClusterHistoryQueryData,
    setClusterMetricsQueryData
} from './queries';
import { observeClusterMetrics, requestClusterHistory } from '../api/service';
import { resolveClusterMetricId } from '../utilities/resolve-cluster-metric-id';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback, useEffect } from 'react';

interface UseClusterMetricsOptions {
    clusterId?: string | null;
};

const useClusterMetrics = (options: UseClusterMetricsOptions = {}) => {
    const queryClient = useQueryClient();
    const selectedTeamId = useSelectedTeamId();

    const selectedClusterId = useClusterStore((state) => state.selectedClusterId);
    const isConnected = useClusterStore((state) => state.isConnected);
    const setSelectedClusterId = useClusterStore((state) => state.setSelectedClusterId);
    const setConnected = useClusterStore((state) => state.setConnected);
    const targetClusterId = options.clusterId ?? selectedClusterId;

    useEffect(() => {
        return observeClusterMetrics({
            onConnectionChange: (connected) => {
                setConnected(connected);

                if (!connected) {
                    resetClusterHistoryQuery(queryClient);
                }
            },
            onMetricsAll: (clusters) => {
                setClusterMetricsQueryData(queryClient, clusters);

                const state = useClusterStore.getState();
                if (!state.selectedClusterId && clusters.length > 0) {
                    state.setSelectedClusterId(resolveClusterMetricId(clusters[0]));
                }
            },
            onMetricsHistory: ({ clusterId, history }) => {
                setClusterHistoryQueryData(
                    queryClient,
                    history,
                    clusterId
                );
            }
        });
    }, [queryClient, setConnected]);

    const { data: clusters = [] } = clusterMetricsQuery(undefined);
    const historyClusterId = targetClusterId ?? '';
    const { data: history = [] } = clusterHistoryQuery(historyClusterId);
    const { data: isHistoryLoaded = false } = clusterHistoryLoadedQuery(historyClusterId);

    const metrics = useMemo(() => {
        if (!clusters.length) return null;
        return clusters.find((cluster) => resolveClusterMetricId(cluster) === targetClusterId) || null;
    }, [clusters, targetClusterId]);

    const handleRequestHistory = useCallback((minutes: number = 5, clusterId?: string | null) => {
        const targetClusterId = clusterId ?? useClusterStore.getState().selectedClusterId;
        if (!targetClusterId) {
            return;
        }

        const targetTeamId = selectedTeamId;
        if (!targetTeamId) {
            return;
        }

        const isTargetHistoryLoaded = clusterHistoryLoadedQuery.get(targetClusterId) ?? false;
        if (isTargetHistoryLoaded) {
            return;
        }

        teamSocketRoomService.waitUntilSubscribed(targetTeamId)
            .then(() => {
                if (clusterHistoryLoadedQuery.get(targetClusterId) ?? false) {
                    return;
                }

                const currentTeamId = useTeamStore.getState().selectedTeamId;
                if (currentTeamId !== targetTeamId) {
                    return;
                }

                return requestClusterHistory(minutes, targetClusterId);
            })
            .catch(console.warn);
    }, [selectedTeamId]);

    return {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isConnected,
        isHistoryLoaded,
        history,
        requestHistory: handleRequestHistory
    };
};

export default useClusterMetrics;
