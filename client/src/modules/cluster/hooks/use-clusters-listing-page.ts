import { teamClusterService } from '@/modules/cluster/api/service/team-cluster';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import { TEAM_CLUSTER_QUERY_KEYS } from '@/modules/cluster/hooks/team-cluster/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { resolveClusterMetricId } from '@/modules/cluster/utilities/resolve-cluster-metric-id';
import { transformClustersToRows } from '@/modules/cluster/utilities/transform-cluster-row';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import type { ListTeamClustersInputDTO } from '@/modules/cluster/api/dtos/team-cluster/list-team-clusters';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { ServerRow } from '@/modules/cluster/utilities/transform-cluster-row';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { InfiniteData } from '@tanstack/react-query';

type ClusterListingCache = InfiniteData<PaginatedResponse<ServerRow>, number>;

const createEmptyClustersResponse = (page: number, limit: number): PaginatedResponse<ServerRow> => {
    return {
        status: 'success',
        data: [],
        pagination: {
            page,
            limit,
            total: 0,
            totalPages: 1,
            hasMore: false
        }
    };
};

const isClusterListingCache = (cachedData: unknown): cachedData is ClusterListingCache => {
    if (!cachedData || typeof cachedData !== 'object') {
        return false;
    }

    if (!('pages' in cachedData) || !('pageParams' in cachedData)) {
        return false;
    }

    return Array.isArray(cachedData.pages) && Array.isArray(cachedData.pageParams);
};

const refreshClusterListingRows = (
    cachedData: unknown,
    metricsByClusterId: Record<string, ClusterMetrics>,
    isMetricsConnected: boolean
): unknown => {
    if (!isClusterListingCache(cachedData)) {
        return cachedData;
    }

    return {
        ...cachedData,
        pages: cachedData.pages.map((page) => ({
            ...page,
            data: transformClustersToRows(page.data.map((row) => ({
                teamCluster: row.teamCluster,
                metrics: metricsByClusterId[row.teamCluster._id] ?? null,
                isMetricsConnected
            })))
        }))
    };
};

const useClustersListingPage = () => {
    const queryClient = useQueryClient();
    const selectedTeamId = useSelectedTeamId();
    const metricsState = useClusterMetrics();

    const metricsByClusterId = useMemo<Record<string, ClusterMetrics>>(() => {
        return metricsState.clusters.reduce<Record<string, ClusterMetrics>>((acc, cluster) => {
            const clusterId = resolveClusterMetricId(cluster);
            acc[clusterId] = cluster;
            return acc;
        }, {});
    }, [metricsState.clusters]);

    const mapClustersToRows = useCallback((clusters: TeamCluster[]): ServerRow[] => {
        return transformClustersToRows(clusters.map((cluster) => ({
            teamCluster: cluster,
            metrics: metricsByClusterId[cluster._id] ?? null,
            isMetricsConnected: metricsState.isConnected
        })));
    }, [metricsByClusterId, metricsState.isConnected]);

    useEffect(() => {
        if (!selectedTeamId) {
            return;
        }

        queryClient.setQueriesData({
            queryKey: TEAM_CLUSTER_QUERY_KEYS.byTeam(selectedTeamId)
        }, (cachedData) => refreshClusterListingRows(cachedData, metricsByClusterId, metricsState.isConnected));
    }, [metricsByClusterId, metricsState.isConnected, queryClient, selectedTeamId]);

    const fetchClusters = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<ServerRow>> => {
        const page = params.page ?? 1;
        const limit = params.limit ?? 20;

        if (!selectedTeamId) {
            return createEmptyClustersResponse(page, limit);
        }

        const query: ListTeamClustersInputDTO = {
            teamId: selectedTeamId,
            page,
            limit
        };

        const search = params.search?.trim();
        if (search) {
            query.search = search;
        }

        const response = await teamClusterService.listByTeamId(query);

        return {
            ...response,
            data: mapClustersToRows(response.data)
        };
    }, [mapClustersToRows, selectedTeamId]);

    return {
        selectedTeamId,
        fetchClusters
    };
};

export default useClustersListingPage;
