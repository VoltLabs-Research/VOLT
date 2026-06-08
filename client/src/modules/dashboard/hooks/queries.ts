import service from '../api/service';
import { buildKeys, createQuery } from '@/shared/infrastructure/query';
import type { GlobalSearchInputDTO } from '@/modules/dashboard/api/service';

interface DashboardQueryKeys {
    globalSearch: GlobalSearchInputDTO;
    metrics: void;
}

const KEYS = buildKeys<DashboardQueryKeys>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
export const useDashboardMetricsQuery = createQuery(KEYS.metrics, () => service.getMetrics({}));
