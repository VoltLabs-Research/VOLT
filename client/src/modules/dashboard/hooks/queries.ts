import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/query';
import type { GlobalSearchInput } from '@/modules/dashboard/api/service';

interface DashboardQueryKeys {
    globalSearch: GlobalSearchInput;
    metrics: void;
}

const KEYS = buildKeys<DashboardQueryKeys>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
export const useDashboardMetricsQuery = createQuery(KEYS.metrics, () => service.getMetrics({}));
