import service from '../api/service';
import { buildKeys } from '@/shared/query/query-keys';
import { createQuery } from '@/shared/query/create-query';
import type { GlobalSearchInput } from '@/modules/dashboard/api/service';

interface DashboardQueryKeys {
    globalSearch: GlobalSearchInput;
}

const KEYS = buildKeys<DashboardQueryKeys>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
