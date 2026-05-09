import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import type { GlobalSearchInputDTO } from '@/modules/dashboard/api/service';

interface DashboardQueryKeys extends Record<string, unknown> {
    globalSearch: GlobalSearchInputDTO;
    metrics: void;
}

const KEYS = buildKeys<DashboardQueryKeys>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
export const useDashboardMetricsQuery = createQuery(KEYS.metrics, () => service.getMetrics({}));
