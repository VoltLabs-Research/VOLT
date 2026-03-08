import { buildKeys, createQuery } from '@/shared/infrastructure/query/create-paginated-query';
import type { GlobalSearchInputDTO } from '@/modules/dashboard/api/dtos/global-search';
import service from '../api/service';

const KEYS = buildKeys<{
    globalSearch: GlobalSearchInputDTO;
}>('dashboard');

export const useGlobalSearchQuery = createQuery(KEYS.globalSearch, service.search);
