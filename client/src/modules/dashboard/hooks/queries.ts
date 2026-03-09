import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import type { ListDashboardTeamClustersInputDTO } from '@/modules/dashboard/api/dtos/list-team-clusters';
import type { GlobalSearchInputDTO } from '@/modules/dashboard/api/dtos/global-search';
import type { DashboardTeamCluster } from '@/modules/dashboard/api/entities/team-cluster';

interface DashboardQueryKeys extends Record<string, unknown> {
    globalSearch: GlobalSearchInputDTO;
    metrics: void;
    teamClusters: ListDashboardTeamClustersInputDTO;
};

const KEYS = buildKeys<DashboardQueryKeys>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
export const useDashboardMetricsQuery = createQuery(KEYS.metrics, () => service.getMetrics({}));
export const useDashboardTeamClustersQuery = createQuery<ListDashboardTeamClustersInputDTO, DashboardTeamCluster[]>(
    KEYS.teamClusters,
    service.listTeamClusters
);
