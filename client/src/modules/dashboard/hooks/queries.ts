import service from '../api/service';
import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import type { GetDashboardMetricsInput, GlobalSearchInput } from '@/modules/dashboard/api/service';

interface DashboardQueryKeys {
    globalSearch: GlobalSearchInput;
    metrics: GetDashboardMetricsInput;
}

const KEYS = buildKeys<DashboardQueryKeys>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
export const useDashboardMetricsQuery = createQuery(KEYS.metrics, service.getMetrics);
